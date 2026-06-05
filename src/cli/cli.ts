import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { platform } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { CommandLineArgs, OutputFormat } from "./types.js";

const DEFAULT_TEMPLATE_PATH = "./workspace/templates/default.html";
const DEFAULT_INPUT_PATH = "./workspace/content/resume.yaml";
const DEFAULT_OUTPUT_PATH = "./resumes";
const VALID_EXTENSIONS = /\.(yaml|yml|json)$/i;
const VALID_FORMATS: readonly OutputFormat[] = ["pdf", "html", "both"];
const OS_BROWSER_CANDIDATES: Record<string, string[]> = {
    linux: [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser"
    ],
    darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ],
    win32: [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    ]
};

const HELP = `Usage: resumint [path] [options]

Arguments:
  path                          Path to a YAML or JSON data file (relative or absolute).
                                Extension (.yaml, .yml, .json) is required.
                                Defaults to ${DEFAULT_INPUT_PATH}.

Options:
  -t, --template-path <path>    Path to a template HTML file
  -v, --variant <name>          Generate only this variant
  -n, --name <stem>             Output filename stem (e.g. john-doe)
  -o, --output-path <dir>       Output directory (default: ./resumes)
  -b, --browser-path <path>     Path to Chrome/Chromium executable (auto-detected if omitted)
  -f, --format <pdf|html|both>  Output format (default: pdf)
  -s, --skip-spell-check        Skip spell checking
  -V, --verbose                 Print detailed logs and timing information
  -h, --help                    Show this help and exit
      --version                 Show version and exit

Examples:
  resumint
  resumint ./workspace/content/example.yaml
  resumint ./workspace/content/example.yaml --variant en
  resumint ./workspace/content/example.yaml -f both -o ./my-resumes
  resumint ./workspace/content/example.yaml --format html
  resumint ./workspace/content/example.yaml -t ./workspace/templates/fancy.html
`;

function readVersion(): string {
    const pkgUrl = new URL("../../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, "utf8")) as { version: string };
    return pkg.version;
}

function resolveBrowserPath(cliPath?: string): string {
    if (cliPath) {
        if (!existsSync(cliPath)) {
            throw new Error(`--browserPath does not exist: ${cliPath}`);
        }
        return cliPath;
    }

    const envPath = process.env["PUPPETEER_EXECUTABLE_PATH"];
    if (envPath) {
        if (!existsSync(envPath)) {
            throw new Error(
                `PUPPETEER_EXECUTABLE_PATH does not exist: ${envPath}`
            );
        }
        return envPath;
    }

    const osBrowserCandidates = OS_BROWSER_CANDIDATES[platform()] ?? [];
    for (const osBrowserPath of osBrowserCandidates) {
        if (existsSync(osBrowserPath)) return osBrowserPath;
    }

    throw new Error(
        "No Chrome/Chromium found. Install Chrome/Chromium or pass --browserPath /path/to/chrome."
    );
}

function parseArguments(): CommandLineArgs {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            "template-path": { type: "string", short: "t" },
            variant: { type: "string", short: "v" },
            name: { type: "string", short: "n" },
            "output-path": {
                type: "string",
                short: "o",
                default: "./resumes"
            },
            "browser-path": { type: "string", short: "b" },
            format: { type: "string", short: "f", default: "pdf" },
            "skip-spell-check": { type: "boolean", short: "s", default: false },
            verbose: { type: "boolean", short: "V", default: false },
            help: { type: "boolean", short: "h", default: false },
            version: { type: "boolean", default: false }
        }
    });

    if (values.help) {
        console.log(HELP);
        process.exit(0);
    }
    if (values.version) {
        console.log(readVersion());
        process.exit(0);
    }

    const input = positionals[0] ?? DEFAULT_INPUT_PATH;
    if (!VALID_EXTENSIONS.test(input)) {
        throw new Error(
            `Input file must end in .yaml, .yml, or .json: ${input}`
        );
    }

    const templatePath = resolve(
        process.cwd(),
        values["template-path"] ?? DEFAULT_TEMPLATE_PATH
    );
    if (!existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
    }

    const outputPath = resolve(
        process.cwd(),
        values["output-path"] ?? DEFAULT_OUTPUT_PATH
    );
    if (!existsSync(outputPath)) {
        mkdirSync(outputPath, { recursive: true });
    }

    const format = values.format ?? "pdf";
    if (!VALID_FORMATS.includes(format as OutputFormat)) {
        throw new Error(
            `Invalid --format value: ${format}. Expected one of: ${VALID_FORMATS.join(", ")}`
        );
    }

    const browserPath = resolveBrowserPath(values["browser-path"]);

    return {
        input,
        templatePath,
        variant: values.variant,
        name: values.name,
        outputPath,
        browserPath,
        format: format as OutputFormat,
        skipSpellCheck: values["skip-spell-check"] ?? false,
        verbose: values.verbose ?? false
    };
}

export default { parseArguments };
