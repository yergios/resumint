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
    ResumeMetadata,
    Variant
} from "./types.js";
import { normalizeVariants } from "./variants.js";

const DEFAULT_TEMPLATE_PATH = "./workspace/templates/default.html";

function generateBaseFileName(
    date: string,
    variantName: string,
    name: string
): string {
    return `${date}-${variantName}-${name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")}`;
}

async function runSpellCheck(
    html: string,
    language: string,
    variantName: string,
    generationResult: GenerationResult
): Promise<void> {
    const { logger } = generationResult;
    const t = performance.now();
    const result = await spellCheckHtml(html, language);
    logger.perf(`Spell check (${variantName})`, performance.now() - t);

    if (result.misspelledCount > 0) {
        logger.warn(
            `Found ${result.misspelledCount} misspelled words in '${variantName}' resume:`
        );
        result.misspelled.forEach(({ word, suggestions }) => {
            logger.warn(
                `\t- "${word}" -> Suggestions: ${suggestions.join(", ")}`
            );
        });
    } else {
        logger.info(`No spelling errors found in ${variantName} resume`);
    }
}

async function generateResumeForVariant(
    browser: Browser | undefined,
    options: CommandLineArgs,
    generationResult: GenerationResult
) {
    const { logger, variant } = generationResult;
    const t = performance.now();

    let newPagePromise: Promise<Page> | undefined;
    if (options.format !== "html") {
        newPagePromise = browser?.newPage();
    }

    const htmlPath = join(
        generationResult.outputDir,
        `${generationResult.baseFileName}.html`
    );

    const spellCheckPromise =
        !options.skipSpellCheck && variant.language
            ? runSpellCheck(
                  generationResult.html,
                  variant.language,
                  variant.name,
                  generationResult
              )
            : undefined;

    writeFileSync(htmlPath, generationResult.html);

    let pdfGenerationPromise: Promise<void> | undefined;
    if (options.format === "html") {
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

    if (options.format === "pdf" && generationResult.success) {
        unlinkSync(htmlPath);
    }

    logger.perf(`Total (${variant.name})`, performance.now() - t);
}

export async function generateResumes(options: CommandLineArgs) {
    try {
        let browser: Browser | undefined;
        if (options.format !== "html") {
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

        const allVariants = normalizeVariants(resumeData.variants);
        if (allVariants.length === 0) {
            throw new Error("No variants declared in resume data");
        }

        let variants: Variant[];
        if (options.variant) {
            const match = allVariants.find((v) => v.name === options.variant);
            if (!match) {
                const names = allVariants.map((v) => v.name).join(", ");
                throw new Error(
                    `Unknown variant: '${options.variant}'. Valid variants: ${names}`
                );
            }
            variants = [match];
        } else {
            variants = allVariants;
        }

        const variantNames = allVariants.map((v) => v.name);
        const currentDate = getCurrentDate();
        const templateSource = readFileSync(templatePath, "utf8");
        const dataFileName = basename(options.input, extname(options.input));
        const templatesAbsPath = dirname(templatePath);
        const totalStart = performance.now();

        await Promise.all(
            variants.map((variant) => {
                const logger = createLogger(options.verbose);
                const generationResult: GenerationResult = {
                    variant,
                    outputDir,
                    baseFileName: generateBaseFileName(
                        currentDate,
                        variant.name,
                        options.name ?? dataFileName
                    ),
                    html: renderHtml(
                        templateSource,
                        resumeData,
                        variant.name,
                        variantNames,
                        templatesAbsPath
                    ),
                    success: true,
                    logger
                };

                logger.info(`Generating '${variant.name.toUpperCase()}' resume`);
                return generateResumeForVariant(
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
