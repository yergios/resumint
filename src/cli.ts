import { join } from "node:path";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import type { CommandLineArgs } from "./models/generator.js";

const parseArguments = async (): Promise<CommandLineArgs> => {
    const argv = await yargs(hideBin(process.argv))
        .usage("Usage: $0 [file] [options]")
        .option("data", {
            alias: "d",
            describe:
                "Explicit path to a YAML or JSON data file (overrides positional [file])",
            type: "string"
        })
        .option("template", {
            alias: "t",
            describe: "Template name to use",
            type: "string"
        })
        .option("language", {
            alias: "l",
            describe: "Generate resume for specific language only",
            type: "string"
        })
        .option("name", {
            alias: "n",
            describe:
                "Output filename stem (e.g. john-doe → 2026-05-11-en-john-doe.pdf)",
            type: "string"
        })
        .option("output", {
            alias: "o",
            describe: "Output directory for the generated files",
            type: "string",
            default: "./resumes"
        })
        .option("html", {
            describe: "Save HTML files along with PDFs",
            type: "boolean",
            default: false
        })
        .option("htmlOnly", {
            describe: "Generate only HTML files, not PDFs",
            type: "boolean",
            default: false
        })
        .option("templatesDir", {
            describe: "Directory containing templates",
            type: "string",
            default: "./workspace/templates"
        })
        .option("noSpellCheck", {
            describe: "Skip spell checking",
            type: "boolean",
            default: false
        })
        .option("verbose", {
            alias: "V",
            describe: "Print detailed logs and timing information",
            type: "boolean",
            default: false
        })
        .example(
            "$0 example.yaml",
            "Generate resumes from ./workspace/content/example.yaml"
        )
        .example(
            "$0 example.yaml --language en",
            "Generate resume only for English"
        )
        .example(
            "$0 example.yaml --template fancy",
            "Use the fancy-template.html template"
        )
        .example(
            "$0 example.yaml --html --output ./my-resumes",
            "Save both HTML and PDF to custom directory"
        )
        .example(
            "$0 --data ./my-resume.yaml",
            "Generate resumes from an explicit path"
        )
        .help()
        .alias("help", "h")
        .version()
        .alias("version", "v").argv;

    const positionalFile = argv._?.[0] as string | undefined;
    const resolvedFile = positionalFile
        ? /\.(yaml|yml|json)$/i.test(positionalFile)
            ? positionalFile
            : `${positionalFile}.yaml`
        : "resume.yaml";
    const data = argv.data ?? join("./workspace/content", resolvedFile);

    return {
        data,
        template: argv.template,
        templatesDir: argv.templatesDir ?? "./workspace/templates",
        output: argv.output ?? "./resumes",
        language: argv.language,
        name: argv.name,
        html: argv.html ?? false,
        htmlOnly: argv.htmlOnly ?? false,
        noSpellCheck: argv.noSpellCheck ?? false,
        verbose: argv.verbose ?? false
    };
};

export default { parseArguments };
