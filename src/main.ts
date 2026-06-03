#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { load as yamlLoad } from "js-yaml";
import cli from "./cli/cli.js";
import { createLogger } from "./logging/logger.js";
import { type Browser, launch } from "puppeteer-core";
import { resolveBrowserPath } from "./generate/browser.js";
import { renderHtml } from "./generate/html.js";
import { getCurrentDate, getErrorMessage } from "./utils.js";
import { normalizeVariants } from "./generate/variants.js";
import type {
    GenerationResult,
    ResumeMetadata,
    Variant
} from "./generate/types.js";
import {
    generateBaseFileName,
    generateResumeForVariant
} from "./generate/generator.js";

const DEFAULT_TEMPLATE_PATH = "./workspace/templates/default.html";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
    const totalStart = performance.now();
    const logger = createLogger();

    let t = performance.now();
    const options = cli.parseArguments();
    logger.perf("CLI parsing", performance.now() - t);

    t = performance.now();
    let browser: Browser | undefined;
    if (options.format !== "html") {
        browser = await launch({
            headless: true,
            executablePath: resolveBrowserPath(options.browserPath),
            args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        });
    }
    logger.perf("Browser startup", performance.now() - t);

    t = performance.now();
    const resumeData = yamlLoad(
        readFileSync(options.input, "utf8")
    ) as ResumeMetadata & Record<string, unknown>;
    logger.perf("Resume data loading", performance.now() - t);

    t = performance.now();
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
    logger.perf("Prepping for resume generation", performance.now() - t);

    try {
        const variantNames = allVariants.map((v) => v.name);
        const currentDate = getCurrentDate();
        const templateSource = readFileSync(templatePath, "utf8");
        const dataFileName = basename(options.input, extname(options.input));
        const templatesAbsPath = dirname(templatePath);

        await Promise.all(
            variants.map((variant) => {
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

                logger.info(
                    `Generating '${variant.name.toUpperCase()}' resume`
                );
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

    logger.perf("Resumes generation", performance.now() - t);
    logger.perf("Total overall", performance.now() - totalStart);
    logger.print(options.verbose);
}

main();
