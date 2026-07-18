import { resolve } from "node:path";
import type { Page } from "puppeteer-core";
import type { Logger } from "../logging/types.js";

// A4 at 96 DPI is ~1123px; 1200 gives headroom for subpixel rounding and browser zoom
export const A4_HEIGHT_PX = 1200;

export async function generatePDF(
    page: Page,
    htmlPath: string,
    outputPath: string,
    logger: Logger
) {
    const absoluteHtmlPath = `file://${resolve(htmlPath)}`;

    const navT = performance.now();
    await page.emulateMediaType("print");
    await page.goto(absoluteHtmlPath, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    logger.perf("Page navigation", performance.now() - navT);

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
        logger.error(
            `Content height exceeds A4 maximum (${contentHeight}px > ${A4_HEIGHT_PX}px)`
        );
        return;
    }

    const pdfT = performance.now();
    await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
    logger.perf("PDF generation", performance.now() - pdfT);

    logger.info(`PDF generated: '${outputPath}'`);
}
