import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { join } from "path";

const parseArguments = async () => {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 [file] [options]")
    .option("data", {
      alias: "d",
      describe: "Explicit path to the resume data JSON file (overrides positional [file])",
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
    .option("output", {
      alias: "o",
      describe: "Output directory for the generated files",
      type: "string",
      default: "./output"
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
      default: "./templates"
    })
    .option("noSpellCheck", {
      describe: "Skip spell checking",
      type: "boolean",
      default: false
    })
    .example("$0 example-data.json", "Generate resumes from ./data/example-data.json")
    .example("$0 example-data.json --language en", "Generate resume only for English")
    .example("$0 example-data.json --template fancy", "Use the fancy-template.html template")
    .example(
      "$0 example-data.json --html --output ./my-resumes",
      "Save both HTML and PDF to custom directory"
    )
    .example("$0 --data ./my-resume.json", "Generate resumes from an explicit path")
    .help()
    .alias("help", "h")
    .version()
    .alias("version", "v").argv;

  const positionalFile = argv._?.[0] as string | undefined;
  const data =
    argv.data ?? (positionalFile ? join("./data", positionalFile) : "./data/resume-data.yaml");

  return { ...argv, data };
};

export default {
  parseArguments
};
