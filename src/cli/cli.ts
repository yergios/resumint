import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { CommandLineArgs, OutputFormat } from "../generate/types.js";

const DEFAULT_INPUT_PATH = "./workspace/content/resume.yaml";
const VALID_EXTENSIONS = /\.(yaml|yml|json)$/i;
const VALID_FORMATS: readonly OutputFormat[] = ["pdf", "html", "both"];

const HELP = `Usage: resumint [path] [options]

Arguments:
  path                       Path to a YAML or JSON data file (relative or absolute).
                             Extension (.yaml, .yml, .json) is required.
                             Defaults to ${DEFAULT_INPUT_PATH}.

Options:
  -t, --template-path <path> Path to a template HTML file
  -l, --language <lang>      Generate resume for specific language only
  -n, --name <stem>          Output filename stem (e.g. john-doe)
  -o, --output-path <dir>    Output directory                       [default: ./resumes]
  -b, --browser-path <path>  Path to Chrome/Chromium executable (auto-detected if omitted)
  -f, --format <pdf|html|both>  Output format                        [default: pdf]
  -s, --skip-spell-check     Skip spell checking
  -V, --verbose              Print detailed logs and timing information
  -h, --help                 Show this help and exit
  -v, --version              Show version and exit

Examples:
  resumint
  resumint ./workspace/content/example.yaml
  resumint ./workspace/content/example.yaml --language en
  resumint ./workspace/content/example.yaml -f both -o ./my-resumes
  resumint ./workspace/content/example.yaml --format html
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

    const format = values.format ?? "pdf";
    if (!VALID_FORMATS.includes(format as OutputFormat)) {
        throw new Error(
            `Invalid --format value: ${format}. Expected one of: ${VALID_FORMATS.join(", ")}`
        );
    }

    return {
        input,
        templatePath: values["template-path"],
        outputPath: values["output-path"] ?? "./resumes",
        language: values.language,
        name: values.name,
        browserPath: values["browser-path"],
        format: format as OutputFormat,
        skipSpellCheck: values["skip-spell-check"] ?? false,
        verbose: values.verbose ?? false
    };
};

export default { parseArguments };
