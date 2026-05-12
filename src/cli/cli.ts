import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { CommandLineArgs } from "../generate/types.js";

const DEFAULT_INPUT_PATH = "./workspace/content/resume.yaml";
const VALID_EXTENSIONS = /\.(yaml|yml|json)$/i;

const HELP = `Usage: resumint [path] [options]

Arguments:
  path                       Path to a YAML or JSON data file (relative or absolute).
                             Extension (.yaml, .yml, .json) is required.
                             Defaults to ${DEFAULT_INPUT_PATH}.

Options:
  -t, --template-path <path> Path to a template HTML file
  -l, --language <lang>      Generate resume for specific language only
  -f, --filename <stem>      Output filename stem (e.g. john-doe)
  -o, --output-path <dir>    Output directory                       [default: ./resumes]
  -b, --browser-path <path>  Path to Chrome/Chromium executable (auto-detected if omitted)
  -k, --keep-html            Keep rendered HTML alongside the PDF
  -n, --no-pdf               Render HTML only, do not produce a PDF
  -s, --skip-spell-check     Skip spell checking
  -V, --verbose              Print detailed logs and timing information
  -h, --help                 Show this help and exit
  -v, --version              Show version and exit

Examples:
  resumint
  resumint ./workspace/content/example.yaml
  resumint ./workspace/content/example.yaml --language en
  resumint ./workspace/content/example.yaml -k -o ./my-resumes
  resumint ./workspace/content/example.yaml --no-pdf
  resumint ./workspace/content/example.yaml -t ./workspace/templates/fancy.html
`;

function readVersion(): string {
    const pkgUrl = new URL("../../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, "utf8")) as { version: string };
    return pkg.version;
}

const parseArguments = async (): Promise<CommandLineArgs> => {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            "template-path": { type: "string", short: "t" },
            language: { type: "string", short: "l" },
            filename: { type: "string", short: "f" },
            "output-path": {
                type: "string",
                short: "o",
                default: "./resumes"
            },
            "browser-path": { type: "string", short: "b" },
            "keep-html": { type: "boolean", short: "k", default: false },
            "no-pdf": { type: "boolean", short: "n", default: false },
            "skip-spell-check": { type: "boolean", short: "s", default: false },
            verbose: { type: "boolean", short: "V", default: false },
            help: { type: "boolean", short: "h", default: false },
            version: { type: "boolean", short: "v", default: false }
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

    return {
        input,
        templatePath: values["template-path"],
        outputPath: values["output-path"] ?? "./resumes",
        language: values.language,
        filename: values.filename,
        browserPath: values["browser-path"],
        keepHtml: values["keep-html"] ?? false,
        noPdf: values["no-pdf"] ?? false,
        skipSpellCheck: values["skip-spell-check"] ?? false,
        verbose: values.verbose ?? false
    };
};

export default { parseArguments };
