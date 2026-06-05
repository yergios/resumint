#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { load as yamlLoad } from "js-yaml";
import { type Browser, launch } from "puppeteer-core";
import cli from "./cli/cli.js";
import {
    generateResumeBaseName as generateResumeBasename,
    generateResumeForVariant
} from "./generate/generator.js";
import { renderHtml } from "./generate/html.js";
import type { GenerationResult, ResumeMetadata } from "./generate/types.js";
import { getVariants } from "./generate/variants.js";
import { createLogger } from "./logging/logger.js";
import { getCurrentDate, getErrorMessage } from "./utils.js";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
    const totalStartT = performance.now();
    const logger = createLogger();

    const cliParsingT = performance.now();
    const options = cli.parseArguments();
    logger.perf("CLI parsing", performance.now() - cliParsingT);

    const browserStartupT = performance.now();
    let browser: Browser | undefined;
    if (options.format !== "html") {
        browser = await launch({
            headless: true,
            executablePath: options.browserPath,
            args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        });
    }
    logger.perf("Browser startup", performance.now() - browserStartupT);

    const resumeDataLoadingT = performance.now();
    const resumeData = yamlLoad(
        readFileSync(options.input, "utf8")
    ) as ResumeMetadata & Record<string, unknown>;
    logger.perf("Resume data loading", performance.now() - resumeDataLoadingT);

    const resumesGenerationT = performance.now();
    const variants = getVariants(resumeData.variants, options.variant);
    const variantNames = variants.map((v) => v.name);
    const currentDate = getCurrentDate();
    const resumeTemplate = readFileSync(options.templatePath, "utf8");
    const templatesAbsPath = dirname(options.templatePath);

    try {
        await Promise.all(
            variants.map((variant) => {
                const resumeBasenameT = performance.now();
                const resumeBasename = generateResumeBasename(
                    variant.name,
                    currentDate,
                    options.input,
                    options.name
                );
                logger.perf(
                    `Resume basename variant '${variant.name}'`,
                    performance.now() - resumeBasenameT
                );

                const renderHtmlT = performance.now();
                const html = renderHtml(
                    resumeTemplate,
                    resumeData,
                    variant.name,
                    variantNames,
                    templatesAbsPath
                );
                logger.perf(
                    `HTML rendering for variant '${variant.name}'`,
                    performance.now() - renderHtmlT
                );

                const generationResult: GenerationResult = {
                    variant,
                    outputPath: options.outputPath,
                    resumeBasename,
                    html,
                    logger
                };

                logger.debug(`Generating '${variant.name}' resume`);

                return generateResumeForVariant(
                    browser,
                    options,
                    generationResult
                );
            })
        );

        await browser?.close();
    } catch (err) {
        console.error(`Error: ${getErrorMessage(err)}`);
        process.exit(1);
    }

    logger.perf("Resumes generation", performance.now() - resumesGenerationT);
    logger.perf("Total overall", performance.now() - totalStartT);
    logger.print(options.verbose ? 0 : 1);
}

main();
