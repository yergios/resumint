import {
    existsSync,
    mkdirSync,
    readFileSync,
    unlinkSync,
    writeFileSync
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import Handlebars from "handlebars";
import { load as yamlLoad } from "js-yaml";
import { type Browser, launch, type Page } from "puppeteer";
import { ICON_SVGS } from "./icons.js";
import { createLogger } from "../logging/logger.js";
import type {
    CommandLineArgs,
    GenerationResult,
    ResumeMetadata
} from "./types.js";
import { spellCheckHtml } from "../spell-check/spell-checker.js";
import { getCurrentDate, getErrorMessage } from "../utils.js";

// A4 at 96 DPI is ~1123px; 1200 gives headroom for subpixel rounding and browser zoom
const A4_HEIGHT_PX = 1200;

function generateBaseFileName(
    date: string,
    language: string,
    name: string
): string {
    return `${date}-${language}-${name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")}`;
}

function setupHandlebars(): void {
    Handlebars.registerHelper("eq", (a, b) => a === b);
    Handlebars.registerHelper("join", (array, separator) =>
        array.join(separator)
    );
    Handlebars.registerHelper("getIconSvg", (type: string) => {
        return new Handlebars.SafeString(ICON_SVGS[type] ?? "");
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
    const { logger } = generationResult;
    const absoluteHtmlPath = `file://${resolve(htmlPath)}`;
    await page.emulateMediaType("print");
    await page.goto(absoluteHtmlPath, { waitUntil: "networkidle0" });

    const { contentHeight, containerFound } = await page.evaluate(() => {
        const container = document.querySelector(".resume-container");
        if (!container) {
            return {
                contentHeight: document.body.scrollHeight,
                containerFound: false
            };
        }
        return { contentHeight: container.scrollHeight, containerFound: true };
    });

    if (!containerFound) {
        logger.warn("Resume container not found, using body height");
    }

    if (contentHeight > A4_HEIGHT_PX) {
        generationResult.success = false;
        logger.error(
            `Content height exceeds A4 maximum (${contentHeight}px > ${A4_HEIGHT_PX}px)`
        );
        return;
    }

    const t = performance.now();
    await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
    logger.perf(
        `PDF render (${generationResult.language})`,
        performance.now() - t
    );
    logger.info(`PDF generated: ${outputPath}`);
}

async function runSpellCheck(
    html: string,
    language: string,
    generationResult: GenerationResult
): Promise<void> {
    const { logger } = generationResult;
    const t = performance.now();
    const result = await spellCheckHtml(html, language);
    logger.perf(`Spell check (${language})`, performance.now() - t);

    if (result.misspelledCount > 0) {
        logger.warn(
            `Found ${result.misspelledCount} misspelled words in '${language}' resume:`
        );
        result.misspelled.forEach(({ word, suggestions }) => {
            logger.warn(
                `\t- "${word}" -> Suggestions: ${suggestions.join(", ")}`
            );
        });
    } else {
        logger.info(`No spelling errors found in ${language} resume`);
    }
}

async function generateResumeForLanguage(
    browser: Browser | undefined,
    options: CommandLineArgs,
    generationResult: GenerationResult
) {
    const { logger } = generationResult;
    const t = performance.now();

    let newPagePromise: Promise<Page> | undefined;
    if (!options.htmlOnly) {
        newPagePromise = browser?.newPage();
    }

    const htmlPath = join(
        generationResult.outputDir,
        `${generationResult.baseFileName}.html`
    );

    const spellCheckPromise = options.noSpellCheck
        ? undefined
        : runSpellCheck(
              generationResult.html,
              generationResult.language,
              generationResult
          );

    writeFileSync(htmlPath, generationResult.html);

    let pdfGenerationPromise: Promise<void> | undefined;
    if (options.htmlOnly) {
        logger.info(`HTML saved: ${htmlPath}`);
    } else {
        const pdfPath = join(
            generationResult.outputDir,
            `${generationResult.baseFileName}.pdf`
        );
        const page = await newPagePromise;
        if (!page) {
            generationResult.success = false;
            logger.error("Browser page was not created");
            return;
        }
        pdfGenerationPromise = generatePDF(
            page,
            htmlPath,
            pdfPath,
            generationResult
        );
    }

    await spellCheckPromise;
    await pdfGenerationPromise;

    if (!options.html && !options.htmlOnly && generationResult.success) {
        unlinkSync(htmlPath);
    }

    logger.perf(`Total (${generationResult.language})`, performance.now() - t);
}

export async function generateResumes(options: CommandLineArgs) {
    try {
        setupHandlebars();

        let browser: Browser | undefined;
        if (!options.htmlOnly) {
            browser = await launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
                ]
            });
        }

        const resumeData = yamlLoad(
            readFileSync(options.data, "utf8")
        ) as ResumeMetadata & Record<string, unknown>;

        const templateName =
            options.template ?? resumeData.metadata?.template ?? "default";
        const templatePath = resolve(
            process.cwd(),
            options.templatesDir,
            `${templateName}-template.html`
        );

        if (!existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const outputDir = resolve(process.cwd(), options.output);
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }

        const languages = options.language
            ? [options.language]
            : resumeData.languages;
        if (!languages || languages.length === 0) {
            throw new Error(
                "No languages specified in resume data or via --language"
            );
        }

        const currentDate = getCurrentDate();
        const template = Handlebars.compile(readFileSync(templatePath, "utf8"));
        const dataFileName = basename(options.data, extname(options.data));
        const templatesAbsPath = resolve(process.cwd(), options.templatesDir);
        const baseTag = `<base href="file://${templatesAbsPath}/">`;
        const totalStart = performance.now();

        await Promise.all(
            languages.map((language) => {
                const logger = createLogger(options.verbose);
                const rawHtml = template({ ...resumeData, language });
                const generationResult: GenerationResult = {
                    language,
                    templateName,
                    outputDir,
                    baseFileName: generateBaseFileName(
                        currentDate,
                        language,
                        options.name ?? dataFileName
                    ),
                    html: rawHtml.replace("<head>", `<head>\n    ${baseTag}`),
                    success: true,
                    logger
                };

                logger.info(`Generating '${language.toUpperCase()}' resume`);
                return generateResumeForLanguage(
                    browser,
                    options,
                    generationResult
                );
            })
        );

        const rootLogger = createLogger(options.verbose);
        rootLogger.perf("Total overall", performance.now() - totalStart);
        await browser?.close();
    } catch (err) {
        console.error(`Error: ${getErrorMessage(err)}`);
        process.exit(1);
    }
}

export default { generateResumes };
