import {
    existsSync,
    mkdirSync,
    readFileSync,
    unlinkSync,
    writeFileSync
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { load as yamlLoad } from "js-yaml";
import { type Browser, launch, type Page } from "puppeteer-core";
import { createLogger } from "../logging/logger.js";
import { spellCheckHtml } from "../spell-check/spell-checker.js";
import { getCurrentDate, getErrorMessage } from "../utils.js";
import { resolveBrowserPath } from "./browser.js";
import { renderHtml } from "./html.js";
import { generatePDF } from "./pdf.js";
import type {
    CommandLineArgs,
    GenerationResult,
    ResumeMetadata
} from "./types.js";

const DEFAULT_TEMPLATE_PATH = "./workspace/templates/default.html";

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
    if (!options.noPdf) {
        newPagePromise = browser?.newPage();
    }

    const htmlPath = join(
        generationResult.outputDir,
        `${generationResult.baseFileName}.html`
    );

    const spellCheckPromise = options.skipSpellCheck
        ? undefined
        : runSpellCheck(
              generationResult.html,
              generationResult.language,
              generationResult
          );

    writeFileSync(htmlPath, generationResult.html);

    let pdfGenerationPromise: Promise<void> | undefined;
    if (options.noPdf) {
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

    if (!options.noPdf && !options.keepHtml && generationResult.success) {
        unlinkSync(htmlPath);
    }

    logger.perf(`Total (${generationResult.language})`, performance.now() - t);
}

export async function generateResumes(options: CommandLineArgs) {
    try {
        let browser: Browser | undefined;
        if (!options.noPdf) {
            browser = await launch({
                headless: true,
                executablePath: resolveBrowserPath(options.browserPath),
                args: [
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
                ]
            });
        }

        const resumeData = yamlLoad(
            readFileSync(options.input, "utf8")
        ) as ResumeMetadata & Record<string, unknown>;

        const templatePath = resolve(
            process.cwd(),
            options.templatePath ??
                resumeData.metadata?.template ??
                DEFAULT_TEMPLATE_PATH
        );

        if (!existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const outputDir = resolve(process.cwd(), options.outputPath);
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
        const templateSource = readFileSync(templatePath, "utf8");
        const dataFileName = basename(options.input, extname(options.input));
        const templatesAbsPath = dirname(templatePath);
        const totalStart = performance.now();

        await Promise.all(
            languages.map((language) => {
                const logger = createLogger(options.verbose);
                const generationResult: GenerationResult = {
                    language,
                    outputDir,
                    baseFileName: generateBaseFileName(
                        currentDate,
                        language,
                        options.filename ?? dataFileName
                    ),
                    html: renderHtml(
                        templateSource,
                        resumeData,
                        language,
                        resumeData.languages ?? languages,
                        templatesAbsPath
                    ),
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
