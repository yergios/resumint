import { unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { Browser } from "puppeteer-core";
import type { CommandLineArgs } from "src/cli/types.js";
import type { Logger } from "../logging/types.js";
import { runSpellCheck } from "../spell-check/spell-checker.js";
import { getCurrentDate } from "../utils.js";
import { renderHtml } from "./html.js";
import { generatePDF } from "./pdf.js";
import type { Variant } from "./types.js";

export async function generateResumeForVariant(
    variant: Variant,
    template: string,
    data: Record<string, unknown>,
    options: CommandLineArgs,
    browserPromise: Promise<Browser> | undefined,
    logger: Logger
) {
    const variantT = performance.now();

    const resumeBasename = `${getCurrentDate()}-${variant.name}-${
        options.name ||
        basename(options.input, extname(options.input))
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
    }`;

    const renderHtmlT = performance.now();
    const baseHref = `file://${dirname(options.templatePath)}/`;
    const html = renderHtml(template, data, variant.name, baseHref);
    logger.perf("HTML rendering", performance.now() - renderHtmlT);

    const htmlPath = join(`${resumeBasename}.html`);

    // Kick off spell check first so its worker runs while the browser finishes
    // launching and while the PDF renders.
    const spellCheckPromise = !options.skipSpellCheck
        ? runSpellCheck(html, variant, logger)
        : undefined;

    // The PDF renderer navigates this file so a file:// origin can load the
    // template's local assets; it's kept as output only when HTML is wanted.
    writeFileSync(htmlPath, html);
    if (options.format !== "pdf") {
        logger.info(`HTML saved: ${htmlPath}`);
    }

    let pdfGenerationPromise: Promise<void> | undefined;
    if (options.format !== "html") {
        const browser = await browserPromise;
        if (!browser) {
            logger.error("Browser was not created");
            return;
        }
        const pdfPath = join(options.outputPath, `${resumeBasename}.pdf`);
        const page = await browser.newPage();
        pdfGenerationPromise = generatePDF(page, htmlPath, pdfPath, logger);
    }

    await spellCheckPromise;
    await pdfGenerationPromise;

    if (options.format === "pdf") {
        unlinkSync(htmlPath);
    }

    logger.perf("Variant total", performance.now() - variantT);
}
