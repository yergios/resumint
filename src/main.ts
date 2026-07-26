#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { load as yamlLoad } from "js-yaml";
import { type Browser, launch } from "puppeteer-core";
import cli from "./cli/cli.js";
import type { CommandLineArgs } from "./cli/types.js";
import { generateResumeForVariant } from "./generate/generator.js";
import type { ResumeMetadata } from "./generate/types.js";
import { getVariantsToRun, resolveVariantData } from "./generate/variants.js";
import { createLogger } from "./logging/logger.js";
import type { Logger } from "./logging/types.js";
import { serve } from "./serve/server.js";
import { getErrorMessage } from "./utils.js";

if (existsSync(".env")) process.loadEnvFile(".env");

async function launchBrowser(
    options: CommandLineArgs,
    logger: Logger
): Promise<Browser> {
    const t = performance.now();
    const browser = await launch({
        headless: true,
        executablePath: options.browserPath,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });
    logger.perf("Browser startup", performance.now() - t);
    return browser;
}

async function main() {
    const totalStartT = performance.now();
    const logger = createLogger();
    let browserPromise: Promise<Browser> | undefined;
    let threshold = 1;

    try {
        const cliParsingT = performance.now();
        const options = cli.parseArguments();
        threshold = options.verbose ? 0 : 1;
        logger.perf("CLI parsing", performance.now() - cliParsingT);

        // The preview server is a long-running mode of its own: it renders HTML,
        // never touches Chrome, and logs live instead of buffering. Hand off and
        // let its http server + watchers keep the process alive.
        if (options.serve) {
            serve(options);
            return;
        }

        if (options.format !== "html") {
            browserPromise = launchBrowser(options, logger);
        }

        const resumeDataLoadingT = performance.now();
        const resumeData = yamlLoad(
            readFileSync(options.input, "utf8")
        ) as ResumeMetadata & Record<string, unknown>;
        const variantsToRun = getVariantsToRun(
            resumeData.variants,
            options.variant
        );
        const resolvedVariants = resolveVariantData(resumeData, variantsToRun);
        logger.perf(
            "Resume data loading",
            performance.now() - resumeDataLoadingT
        );

        const templateLoadingT = performance.now();
        const template = readFileSync(options.templatePath, "utf8");
        logger.perf("Template loading", performance.now() - templateLoadingT);

        const resumesGenerationT = performance.now();
        await Promise.all(
            resolvedVariants.map(({ variant, data }) => {
                return generateResumeForVariant(
                    variant,
                    template,
                    data,
                    options,
                    browserPromise,
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
        // The browser may still be launching (or have failed to); settle it
        // before closing. A launch failure is already reported by the catch
        // above, so swallow it here and only flag genuine close failures.
        const browser = await browserPromise?.catch(() => undefined);
        if (browser) {
            try {
                await browser.close();
            } catch (error) {
                logger.error(`Browser close failed: ${getErrorMessage(error)}`);
            }
        }
        logger.perf("Total overall", performance.now() - totalStartT);
        logger.print(threshold);
    }
}

main();
