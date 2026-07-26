import { createServer, type ServerResponse } from "node:http";
import { readFileSync, watch } from "node:fs";
import {
    dirname,
    extname,
    join,
    normalize,
    relative,
    resolve,
    sep
} from "node:path";
import { load as yamlLoad } from "js-yaml";
import type { CommandLineArgs } from "../cli/types.js";
import { renderHtml } from "../generate/html.js";
import type { ResumeMetadata } from "../generate/types.js";
import { getVariantsToRun, resolveVariantData } from "../generate/variants.js";
import { ANSI } from "../logging/types.js";
import { getErrorMessage } from "../utils.js";

const DEFAULT_PORT = 3000;
const RELOAD_PATH = "/__reload";

// MIME map for the assets a resume template references.
const MIME_TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf"
};

// Injected into every served page. EventSource auto-reconnects, so a reload
// (which drops the stream) reconnects on its own once the page is back.
const RELOAD_SCRIPT = `<script>new EventSource("${RELOAD_PATH}").onmessage=()=>location.reload();</script>`;

function log(message: string): void {
    console.log(`${ANSI.gray}[serve]${ANSI.white} ${message}`);
}

function logError(message: string): void {
    console.error(`${ANSI.red}[serve]${ANSI.white} ${message}`);
}

function injectReload(html: string): string {
    if (html.includes("</body>")) {
        return html.replace("</body>", `${RELOAD_SCRIPT}</body>`);
    }
    return html + RELOAD_SCRIPT;
}

function errorPage(message: string): string {
    const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return injectReload(
        `<!doctype html><html><head><title>resumint — error</title></head>` +
            `<body style="font-family:monospace;padding:2rem;color:#b00020;">` +
            `<h2>Render error</h2><pre style="white-space:pre-wrap;">${safe}</pre>` +
            `</body></html>`
    );
}

// Read the source files fresh and render the chosen variant to HTML. Called on
// startup and on every watched change, so it always reflects what's on disk.
// `baseHref` mirrors the PDF path's file:// base: it points at the template dir
// under the served root, so the template's ../ asset paths resolve correctly.
function buildHtml(
    options: CommandLineArgs,
    baseHref: string
): { variant: string; html: string } {
    const resumeData = yamlLoad(readFileSync(options.input, "utf8")) as
        | (ResumeMetadata & Record<string, unknown>);
    const variantsToRun = getVariantsToRun(
        resumeData.variants,
        options.variant
    );
    // getVariantsToRun throws on an empty set; default to the first variant.
    const variant = variantsToRun[0];
    if (!variant) throw new Error("No variant available to preview");

    const resolved = resolveVariantData(resumeData, [variant])[0];
    if (!resolved) throw new Error("Failed to resolve variant data");

    const template = readFileSync(options.templatePath, "utf8");
    const html = renderHtml(template, resolved.data, variant.name, baseHref);
    return { variant: variant.name, html: injectReload(html) };
}

// Templates reference assets relative to their own directory, sometimes above
// it (e.g. ../styles/x.css). To reach those over HTTP we serve from the working
// directory and point <base> at the template dir beneath it — the file:// path
// gets this for free since the whole filesystem is reachable there. If the
// template lives outside the working dir we fall back to serving its own dir,
// which only covers assets at or below the template.
function resolveRoots(templateRoot: string): { root: string; baseHref: string } {
    const cwd = process.cwd();
    const rel = relative(cwd, templateRoot);

    if (rel === "") return { root: cwd, baseHref: "/" };
    if (rel.startsWith("..")) return { root: templateRoot, baseHref: "/" };

    return { root: cwd, baseHref: `/${rel.split(sep).join("/")}/` };
}

// Serve a template-relative asset (CSS, fonts, images) from the template
// directory, which is what the "/" <base href> resolves requests against.
function serveStatic(
    root: string,
    urlPath: string,
    res: ServerResponse
): void {
    const relative = decodeURIComponent(urlPath).replace(/^\/+/, "");
    const filePath = normalize(join(root, relative));

    // Path-traversal guard: the resolved path must stay inside the root.
    if (filePath !== root && !filePath.startsWith(root + sep)) {
        res.writeHead(403).end("Forbidden");
        return;
    }

    let data: Buffer;
    try {
        data = readFileSync(filePath);
    } catch {
        res.writeHead(404).end("Not found");
        return;
    }

    const mime =
        MIME_TYPES[extname(filePath).toLowerCase()] ??
        "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime }).end(data);
}

// Pull the directories of the local assets a page links to (stylesheets,
// scripts, images), so their edits can trigger a reload too. Refs are resolved
// against baseHref exactly as the browser resolves them, then mapped back to a
// filesystem path under the served root. External URLs and the "/"-terminated
// base tag are skipped. Note: this sees only assets named in the HTML — a font
// pulled in by a stylesheet's url() isn't listed, but editing the stylesheet
// (which is listed) reloads the page and re-fetches everything anyway.
const REF_RE = /(?:href|src)\s*=\s*"([^"]+)"/g;

function collectAssetDirs(
    html: string,
    root: string,
    baseHref: string
): string[] {
    const dirs = new Set<string>();

    for (const match of html.matchAll(REF_RE)) {
        const ref = match[1];
        if (!ref || ref.endsWith("/")) continue;
        if (/^([a-z]+:|\/\/|#)/i.test(ref)) continue;

        let pathname: string;
        try {
            pathname = new URL(ref, `http://host${baseHref}`).pathname;
        } catch {
            continue;
        }

        const filePath = normalize(join(root, decodeURIComponent(pathname)));
        if (filePath !== root && !filePath.startsWith(root + sep)) continue;

        dirs.add(dirname(filePath));
    }

    return [...dirs];
}

export function serve(options: CommandLineArgs): void {
    const templateRoot = dirname(options.templatePath);
    const { root, baseHref } = resolveRoots(templateRoot);
    const clients = new Set<ServerResponse>();
    let current = { variant: "", html: "" };

    // Debounce: a single save often emits several filesystem events.
    const watched = new Set<string>();
    let timer: NodeJS.Timeout | undefined;

    function scheduleRebuild(): void {
        if (timer) clearTimeout(timer);
        timer = setTimeout(rebuild, 50);
    }

    // Watch a directory (not the file) so the atomic rename-on-save many editors
    // do keeps firing, and so sibling edits in the same dir are caught. Idempotent
    // per dir; a missing dir is ignored.
    function watchDir(dir: string): void {
        if (watched.has(dir)) return;
        try {
            watch(dir, scheduleRebuild);
            watched.add(dir);
        } catch {
            // Directory may not exist; nothing to watch.
        }
    }

    function rebuild(): void {
        try {
            current = buildHtml(options, baseHref);
            log(`rendered '${current.variant}'`);
            // Also watch the dirs of assets this page references (stylesheets,
            // images), re-scanned each build to pick up newly referenced ones.
            for (const dir of collectAssetDirs(current.html, root, baseHref)) {
                watchDir(dir);
            }
        } catch (error) {
            const message = getErrorMessage(error);
            current = { variant: "error", html: errorPage(message) };
            logError(`render failed: ${message}`);
        }
        for (const res of clients) res.write("data: reload\n\n");
    }

    // Watch the source dirs up front so changes are caught even when the first
    // render fails (e.g. broken YAML that references no assets).
    watchDir(dirname(resolve(options.input)));
    watchDir(templateRoot);

    rebuild();

    const server = createServer((req, res) => {
        const path = (req.url ?? "/").split("?")[0] ?? "/";

        if (path === RELOAD_PATH) {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive"
            });
            res.write("retry: 1000\n\n");
            clients.add(res);
            req.on("close", () => clients.delete(res));
            return;
        }

        if (path === "/" || path === "/index.html") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(current.html);
            return;
        }

        serveStatic(root, path, res);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
            logError(`port ${DEFAULT_PORT} is already in use`);
            process.exit(1);
        }
        throw error;
    });

    server.listen(DEFAULT_PORT, () => {
        log(`preview at http://localhost:${DEFAULT_PORT}`);
        log(`watching ${options.input} and ${options.templatePath}`);
    });
}
