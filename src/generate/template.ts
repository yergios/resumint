type Token =
    | { type: "text"; value: string }
    | { type: "var"; path: string }
    | { type: "raw"; path: string }
    | { type: "open"; block: "each" | "if" | "unless"; path: string }
    | { type: "close"; block: "each" | "if" | "unless" };

type Node =
    | { type: "text"; value: string }
    | { type: "var"; path: string }
    | { type: "raw"; path: string }
    | { type: "each"; path: string; children: Node[] }
    | { type: "if"; path: string; children: Node[] }
    | { type: "unless"; path: string; children: Node[] };

interface Frame {
    data: unknown;
    index?: number;
    first?: boolean;
    last?: boolean;
}

const TAG_RE = /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g;

function escape(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function tokenize(src: string): Token[] {
    const out: Token[] = [];
    let pos = 0;
    TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
    while ((m = TAG_RE.exec(src)) !== null) {
        if (m.index > pos) {
            out.push({ type: "text", value: src.slice(pos, m.index) });
        }
        if (m[1] !== undefined) {
            out.push({ type: "raw", path: m[1].trim() });
        } else {
            const inner = (m[2] as string).trim();
            if (inner.startsWith("#each ")) {
                out.push({
                    type: "open",
                    block: "each",
                    path: inner.slice(6).trim()
                });
            } else if (inner === "/each") {
                out.push({ type: "close", block: "each" });
            } else if (inner.startsWith("#if ")) {
                out.push({
                    type: "open",
                    block: "if",
                    path: inner.slice(4).trim()
                });
            } else if (inner === "/if") {
                out.push({ type: "close", block: "if" });
            } else if (inner.startsWith("#unless ")) {
                out.push({
                    type: "open",
                    block: "unless",
                    path: inner.slice(8).trim()
                });
            } else if (inner === "/unless") {
                out.push({ type: "close", block: "unless" });
            } else {
                out.push({ type: "var", path: inner });
            }
        }
        pos = m.index + m[0].length;
    }
    if (pos < src.length) out.push({ type: "text", value: src.slice(pos) });
    return out;
}

function parse(tokens: Token[]): Node[] {
    let i = 0;
    function parseBlock(closeBlock?: "each" | "if" | "unless"): Node[] {
        const nodes: Node[] = [];
        while (i < tokens.length) {
            const tok = tokens[i] as Token;
            if (tok.type === "close") {
                if (closeBlock !== tok.block) {
                    throw new Error(
                        `Unexpected {{/${tok.block}}}, expected {{/${closeBlock ?? "?"}}}`
                    );
                }
                i++;
                return nodes;
            }
            if (tok.type === "open") {
                i++;
                const children = parseBlock(tok.block);
                nodes.push({ type: tok.block, path: tok.path, children });
            } else {
                nodes.push(tok);
                i++;
            }
        }
        if (closeBlock) throw new Error(`Unclosed {{#${closeBlock}}}`);
        return nodes;
    }
    return parseBlock();
}

function resolve(path: string, frame: Frame): unknown {
    if (path === "this") return frame.data;
    if (path === "@index") return frame.index;
    if (path === "@first") return frame.first;
    if (path === "@last") return frame.last;
    let cur: unknown = frame.data;
    for (const seg of path.split(".")) {
        if (cur === null || cur === undefined || typeof cur !== "object") {
            return undefined;
        }
        cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
}

function truthy(v: unknown): boolean {
    if (v === undefined || v === null || v === false || v === 0) return false;
    if (typeof v === "string" && v.length === 0) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
}

function render(nodes: Node[], frame: Frame): string {
    let out = "";
    for (const node of nodes) {
        if (node.type === "text") {
            out += node.value;
        } else if (node.type === "var") {
            const v = resolve(node.path, frame);
            if (v !== undefined && v !== null) out += escape(String(v));
        } else if (node.type === "raw") {
            const v = resolve(node.path, frame);
            if (v !== undefined && v !== null) out += String(v);
        } else if (node.type === "if") {
            if (truthy(resolve(node.path, frame))) {
                out += render(node.children, frame);
            }
        } else if (node.type === "unless") {
            if (!truthy(resolve(node.path, frame))) {
                out += render(node.children, frame);
            }
        } else if (node.type === "each") {
            const v = resolve(node.path, frame);
            if (Array.isArray(v)) {
                for (let i = 0; i < v.length; i++) {
                    out += render(node.children, {
                        data: v[i],
                        index: i,
                        first: i === 0,
                        last: i === v.length - 1
                    });
                }
            }
        }
    }
    return out;
}

export function renderTemplate(
    source: string,
    data: Record<string, unknown>
): string {
    return render(parse(tokenize(source)), { data });
}
