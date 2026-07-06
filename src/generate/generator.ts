import { unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { Browser, Page } from "puppeteer-core";
import { spellCheckHtml } from "../spell-check/spell-checker.js";
import { generatePDF } from "./pdf.js";
import type { CommandLineArgs } from "src/cli/types.js";
import type { GenerationResult, Variant } from "./types.js";
import { createLogger } from "../logging/logger.js";
import { getCurrentDate } from "../utils.js";
import { renderHtml } from "./html.js";
import type { ResumeMetadata } from "./types.js";

export async function runSpellCheck(
    html: string,
    language: string,
    variantName: string,
    generationResult: GenerationResult
): Promise<void> {
    const { logger } = generationResult;
    const t = performance.now();
    const result = await spellCheckHtml(html, language);
    logger.perf(`Spell check '${variantName}'`, performance.now() - t);

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
        logger.info(`No spelling errors found in '${variantName}' resume`);
    }
}

export async function generateResumeForVariant(
    variant: Variant,
    template: string,
    data: ResumeMetadata & Record<string, unknown>,
    options: CommandLineArgs,
    browser: Browser | undefined
) {
    const logger = createLogger();

    const resumeBasenameT = performance.now();
    const resumeBasename = `${getCurrentDate()}-${variant}-${
        options.name ||
        basename(options.input, extname(options.input))
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
    }`;
    logger.perf(
        `Resume basename variant '${variant.name}'`,
        performance.now() - resumeBasenameT
    );

    const renderHtmlT = performance.now();
    const templatesAbsPath = dirname(options.templatePath);
    const html = renderHtml(
        template,
        data,
        variant.name,
        variantNames,
        templatesAbsPath
    );
    logger.perf(
        `HTML rendering for variant '${variant.name}'`,
        performance.now() - renderHtmlT
    );

    const t = performance.now();

    let newPagePromise: Promise<Page> | undefined;
    if (options.format !== "html") {
        newPagePromise = browser?.newPage();
    }

    const htmlPath = join(`${generationResult.resumeBasename}.html`);

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
            generationResult.outputPath,
            `${generationResult.resumeBasename}.pdf`
        );
        const page = await newPagePromise;
        if (!page) {
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

    if (options.format === "pdf") {
        unlinkSync(htmlPath);
    }

    logger.perf(`Total '${variant.name}'`, performance.now() - t);
}
