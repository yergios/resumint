import { resolve, join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import Handlebars from "handlebars";
import { Browser, launch, Page } from "puppeteer";
import spellChecker from "./spell-checker.js";
import {
  ResumeData,
  CommandLineArgs,
  GenerationResult,
  LogEntry,
  LogLevel
} from "./models/generator.js";
import { getCurrentDate, getErrorMessage, Timer } from "./utils.js";

const A4_HEIGHT_PX = 1155;
const MAX_CONTENT_HEIGHT_WARNING = "Content height exceeds A4 maximum";

function createLogEntry(level: LogLevel, message: string): LogEntry {
  return { level, message, timestamp: new Date() };
}

function generateBaseFileName(date: string, language: string, name: string): string {
  return `${date}-${language}-${name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")}`;
}

function handleGenerationError(generationResult: GenerationResult, error: string): void {
  generationResult.errors.push(error);
  generationResult.success = false;
  generationResult.logs.push(createLogEntry("error", error));
}

function formatLogsForConsole(logs: LogEntry[]): string {
  return logs.map((log) => `[${log.level.toUpperCase()}]: ${log.message}`).join("\n");
}

function setupHandlebars(): void {
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("join", (array, separator) => array.join(separator));
  Handlebars.registerHelper("getIcon", (type) => {
    switch (type) {
      case "email":
        return "mail-outline";
      case "phone":
        return "call-outline";
      case "github":
        return "logo-github";
      case "linkedin":
        return "logo-linkedin";
      case "location":
        return "location-outline";
      default:
        return "";
    }
  });
  Handlebars.registerHelper("lookup", (obj, field, subfield) => {
    if (!obj || !field) return "";
    if (typeof subfield === "string") return obj[field][subfield];
    return obj[field] !== undefined ? obj[field] : obj;
  });
}

async function generatePDF(
  page: Page,
  htmlPath: string,
  outputPath: string,
  generationResult: GenerationResult
) {
  const absoluteHtmlPath = `file://${resolve(htmlPath)}`;
  await page.goto(absoluteHtmlPath, { waitUntil: "networkidle0" });

  // Validate height
  const contentHeight = await page.evaluate(() => {
    const container = document.querySelector(".resume-container");
    if (!container) {
      generationResult.logs.push(
        createLogEntry("warn", "Resume container not found, using body height")
      );
      return document.body.scrollHeight;
    }
    return container.scrollHeight;
  });

  if (contentHeight > A4_HEIGHT_PX) {
    const errorMsg = `${MAX_CONTENT_HEIGHT_WARNING} (${contentHeight}px exceeds ${A4_HEIGHT_PX}px)`;
    handleGenerationError(generationResult, errorMsg);
    return;
  }

  await page.pdf({
    path: outputPath,
    format: "A4",
    margin: { top: "0", right: "0", bottom: "0", left: "0" }
  });

  generationResult.logs.push(createLogEntry("info", `PDF generated: ${outputPath}`));
}

async function spellCheckHTML(html: string, language: string, generationResult: GenerationResult) {
  const result = await spellChecker.spellCheckHtml(html, language);

  if (result.misspelledCount > 0) {
    generationResult.logs.push(
      createLogEntry(
        "warn",
        `Found ${result.misspelledCount} misspelled words in '${language}' resume:`
      )
    );
    result.misspelled.forEach(({ word, suggestions }) => {
      generationResult.logs.push(
        createLogEntry("warn", `\t- "${word}" -> Suggestions: ${suggestions.join(", ")}`)
      );
    });
  } else {
    generationResult.logs.push(
      createLogEntry("info", `No spelling errors found in ${language} resume`)
    );
  }
}

async function generateResumeForLanguage(
  browser: Browser,
  options: CommandLineArgs,
  generationResult: GenerationResult
) {
  let newPagePromise;
  if (!options.htmlOnly) {
    newPagePromise = browser.newPage();
  }

  const htmlPath = join(generationResult.outputDir, `${generationResult.baseFileName}.html`);

  let spellCheckPromise;
  if (!options.noSpellCheck) {
    spellCheckPromise = spellCheckHTML(
      generationResult.html,
      generationResult.language,
      generationResult
    );
  }

  writeFileSync(htmlPath, generationResult.html);

  let pdfGenerationPromise;
  if (options.htmlOnly) {
    generationResult.logs.push(createLogEntry("info", `HTML saved: ${htmlPath}`));
  } else {
    const pdfPath = join(generationResult.outputDir, `${generationResult.baseFileName}.pdf`);
    const page = await newPagePromise;
    if (!page) {
      handleGenerationError(generationResult, "Browser page was not created");
      return;
    }
    pdfGenerationPromise = generatePDF(page, htmlPath, pdfPath, generationResult);
  }

  if (spellCheckPromise) {
    await spellCheckPromise;
  }

  if (pdfGenerationPromise) {
    await pdfGenerationPromise;
  }

  if (!options.html && !options.htmlOnly) {
    unlinkSync(htmlPath);
  }

  console.log(formatLogsForConsole(generationResult.logs));
}

export async function generateResumes(options: CommandLineArgs) {
  try {
    const browserLaunchPromise = launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });
    setupHandlebars();

    const resumeData: ResumeData = JSON.parse(readFileSync(options.data, "utf8"));
    const templateName = options.template || resumeData.metadata?.template || "default";
    const templatePath = resolve(
      process.cwd(),
      options.templatesDir,
      `${templateName}-template.html`
    );

    if (!existsSync(templatePath)) {
      console.error(`Template not found: ${templatePath}`);
      process.exit(1);
    }

    const outputDir = resolve(process.cwd(), options.output);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Determine languages
    const languages = options.language ? [options.language] : resumeData.languages;
    if (!languages || languages.length === 0) {
      console.error("No languages specified in resume data or via command line");
      process.exit(1);
    }

    const currentDate = getCurrentDate();
    const templateSource = readFileSync(templatePath, "utf8");
    const template = Handlebars.compile(templateSource);
    const browser = await browserLaunchPromise;

    await Promise.all(
      languages.map((language) => {
        const generationResult: GenerationResult = {
          language: language,
          templateName: templateName,
          outputDir: outputDir,
          baseFileName: generateBaseFileName(currentDate, language, resumeData.basic.name),
          html: template({ ...resumeData, language }),
          logs: [createLogEntry("info", `Resume lang '${language.toUpperCase()}'`)],
          errors: [],
          success: true,
          metadata: {
            generationTime: new Date(),
            spellCheckEnabled: !options.noSpellCheck
          }
        };

        return generateResumeForLanguage(browser, options, generationResult);
      })
    );

    await browser.close();
  } catch (err) {
    console.error(`Error: ${getErrorMessage(err)}`);
    process.exit(1);
  }
}

export default { generateResumes };
