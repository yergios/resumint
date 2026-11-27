import type { Page } from "puppeteer-core";
import type { Logger } from "../logging/types.js";
import { getErrorMessage } from "../utils.js";
import { type RenderedText, runChecks } from "./checks.js";
import {
    buildLayoutLines,
    buildStreamText,
    extractTextItems
} from "./extract.js";
import type { Finding, FindingKind } from "./types.js";

// Each kind is capped so one systemic problem (say, a whole column read out
// of order) doesn't bury the rest of the report.
const MAX_FINDINGS_PER_KIND = 5;

const KIND_LABELS: Record<FindingKind, string> = {
    missing: "Missing text",
    merged: "Merged text",
    order: "Reading order",
    garbled: "Unreadable characters",
    date: "Date formats"
};

// Reads the visible text off the page the PDF was printed from. Must run on
// the same page, after printing, so it sees the print-media layout.
export function collectRenderedText(page: Page): Promise<RenderedText> {
    return page.evaluate(() => {
        const units: string[] = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.trim() ?? "";
            const parent = node.parentElement;
            if (!text || !parent || parent.closest("svg, style, script")) {
                continue;
            }
            if (!parent.checkVisibility({ visibilityProperty: true })) {
                continue;
            }
            units.push(text);
        }
        return { units, fullText: document.body.innerText };
    });
}

function report(findings: Finding[], logger: Logger): void {
    if (findings.length === 0) {
        logger.info("ATS check passed: the PDF text extracts cleanly");
        return;
    }

    logger.warn(`ATS check found ${findings.length} issue(s):`);
    for (const kind of Object.keys(KIND_LABELS) as FindingKind[]) {
        const ofKind = findings.filter((finding) => finding.kind === kind);
        if (ofKind.length === 0) continue;
        logger.warn(`\t${KIND_LABELS[kind]}:`);
        for (const finding of ofKind.slice(0, MAX_FINDINGS_PER_KIND)) {
            logger.warn(`\t\t- ${finding.message}`);
        }
        const hidden = ofKind.length - MAX_FINDINGS_PER_KIND;
        if (hidden > 0) logger.warn(`\t\t... and ${hidden} more`);
    }
}

// Non-fatal like the spell check: a failure is logged, never thrown, so the
// generated PDF is still reported as produced.
export async function runAtsCheck(
    pdfPath: string,
    rendered: RenderedText,
    logger: Logger
): Promise<void> {
    const t = performance.now();
    try {
        const pages = await extractTextItems(pdfPath);
        logger.perf("PDF text extraction", performance.now() - t);

        const findings = runChecks(
            rendered,
            pages,
            buildStreamText(pages),
            buildLayoutLines(pages)
        );
        report(findings, logger);
    } catch (error) {
        logger.error(`ATS check error: ${getErrorMessage(error)}`);
    }
    logger.perf("ATS check", performance.now() - t);
}
