#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { load as yamlLoad } from "js-yaml";
import { type Browser, launch } from "puppeteer-core";
import cli from "./cli/cli.js";
import { generateResumeForVariant } from "./generate/generator.js";
import type { ResumeMetadata } from "./generate/types.js";
import { getVariantsToRun } from "./generate/variants.js";
import { createLogger } from "./logging/logger.js";
import { getErrorMessage } from "./utils.js";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
    const totalStartT = performance.now();
    const logger = createLogger();
    let browser: Browser | undefined;
    // Default to info; raised to debug once we know whether --verbose was
    // passed. Kept outside the try so the finally block can always flush.
    let threshold = 1;

    try {
        const cliParsingT = performance.now();
        const options = cli.parseArguments();
        threshold = options.verbose ? 0 : 1;
        logger.perf("CLI parsing", performance.now() - cliParsingT);

        const browserStartupT = performance.now();
        if (options.format !== "html") {
            browser = await launch({
                headless: true,
                executablePath: options.browserPath,
                args: [
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
                ]
            });
        }
        logger.perf("Browser startup", performance.now() - browserStartupT);

        const resumeDataLoadingT = performance.now();
        const resumeData = yamlLoad(
            readFileSync(options.input, "utf8")
        ) as ResumeMetadata & Record<string, unknown>;
        const variantsToRun = getVariantsToRun(
            resumeData.variants,
            options.variant
        );
        logger.perf(
            "Resume data loading",
            performance.now() - resumeDataLoadingT
        );

        const templateLoadingT = performance.now();
        const template = readFileSync(options.templatePath, "utf8");
        logger.perf("Template loading", performance.now() - templateLoadingT);

        const resumesGenerationT = performance.now();
        await Promise.all(
            variantsToRun.map((variant) => {
                return generateResumeForVariant(
                    variant,
                    template,
                    resumeData,
                    options,
                    browser,
                    logger.forVariant(variant.name)
                );
            })
        );
        logger.perf(
            "Resumes generation",
            performance.now() - resumesGenerationT
        );
    } catch (error) {
        logger.error(getErrorMessage(error));
        process.exitCode = 1;
    } finally {
        // Guard the close so a failure here can't swallow the log flush.
        try {
            await browser?.close();
        } catch (error) {
            logger.error(`Browser close failed: ${getErrorMessage(error)}`);
        }
        logger.perf("Total overall", performance.now() - totalStartT);
        logger.print(threshold);
    }
}

main();
