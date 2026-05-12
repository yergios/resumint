import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { CommandLineArgs } from "../generate/types.js";

const HELP = `Usage: resumint [file] [options]

Arguments:
  file                  Data file under ./workspace/content/ (e.g. example.yaml).
                        Omit extension to default to .yaml. Overridden by --data.

Options:
  -d, --data <path>     Explicit path to a YAML or JSON data file
  -t, --template <name> Template name to use
  -l, --language <lang> Generate resume for specific language only
  -n, --name <stem>     Output filename stem (e.g. john-doe)
  -o, --output <dir>    Output directory                    [default: ./resumes]
      --templatesDir <dir>  Directory containing templates  [default: ./workspace/templates]
      --browserPath <path>  Path to Chrome/Chromium executable (auto-detected if omitted)
      --html            Save HTML files along with PDFs
      --htmlOnly        Generate only HTML files, not PDFs
      --noSpellCheck    Skip spell checking
  -V, --verbose         Print detailed logs and timing information
  -h, --help            Show this help and exit
  -v, --version         Show version and exit

Examples:
  resumint example.yaml
  resumint example.yaml --language en
  resumint example.yaml --template fancy
  resumint example.yaml --html --output ./my-resumes
  resumint --data ./my-resume.yaml
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
            data: { type: "string", short: "d" },
            template: { type: "string", short: "t" },
            language: { type: "string", short: "l" },
            name: { type: "string", short: "n" },
            output: { type: "string", short: "o", default: "./resumes" },
            templatesDir: { type: "string", default: "./workspace/templates" },
            browserPath: { type: "string" },
            html: { type: "boolean", default: false },
            htmlOnly: { type: "boolean", default: false },
            noSpellCheck: { type: "boolean", default: false },
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

    const positionalFile = positionals[0];
    const resolvedFile = positionalFile
        ? /\.(yaml|yml|json)$/i.test(positionalFile)
            ? positionalFile
            : `${positionalFile}.yaml`
        : "resume.yaml";
    const data = values.data ?? join("./workspace/content", resolvedFile);

    return {
        data,
        template: values.template,
        templatesDir: values.templatesDir ?? "./workspace/templates",
        output: values.output ?? "./resumes",
        language: values.language,
        name: values.name,
        browserPath: values.browserPath,
        html: values.html ?? false,
        htmlOnly: values.htmlOnly ?? false,
        noSpellCheck: values.noSpellCheck ?? false,
        verbose: values.verbose ?? false
    };
};

export default { parseArguments };
