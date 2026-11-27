import { readFileSync } from "node:fs";
import type { LayoutLine, PageItems, TextItem } from "./types.js";

// A gap narrower than this fraction of the font height is read as "no space"
// by position-based extractors. Poppler breaks words at roughly 0.1 em; 0.15
// is deliberately a bit stricter so borderline layouts get flagged.
export const SPACE_GAP_RATIO = 0.15;

// Two items share a line when their baselines differ by less than this
// fraction of the smaller height (mixed font sizes sit on slightly different
// baselines, e.g. a company name and its right-aligned location).
const SAME_LINE_RATIO = 0.5;

export async function extractTextItems(pdfPath: string): Promise<PageItems[]> {
    // Loaded lazily: pdfjs is large and only needed when --ats-check is set.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(readFileSync(pdfPath)),
        verbosity: 0
    });

    try {
        const doc = await loadingTask.promise;
        const pages: PageItems[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            // Normalization would fold ligatures like "ﬁ" into "fi", hiding
            // exactly the glyph-mapping problems real parsers trip over.
            const content = await page.getTextContent({
                disableNormalization: true
            });
            const items: TextItem[] = [];
            for (const item of content.items) {
                if (!("str" in item)) continue;
                items.push({
                    str: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    width: item.width,
                    height: item.height,
                    hasEOL: item.hasEOL
                });
            }
            pages.push(items);
        }
        return pages;
    } finally {
        await loadingTask.destroy();
    }
}

// The text in content-stream order, as "raw" extractors read it.
export function buildStreamText(pages: PageItems[]): string {
    let text = "";
    for (const items of pages) {
        for (const item of items) {
            text += item.str;
            if (item.hasEOL) text += "\n";
        }
        text += "\n";
    }
    return text;
}

// Rebuilds visual lines from item positions, ignoring stream order. The
// whitespace-only items pdfjs synthesizes are dropped: spacing is decided by
// the measured gaps instead, the way a position-based extractor would.
export function buildLayoutLines(pages: PageItems[]): LayoutLine[] {
    const lines: LayoutLine[] = [];
    for (const items of pages) {
        const visible = items
            .filter((item) => item.str.trim() !== "" && item.height > 0)
            .sort((a, b) => b.y - a.y || a.x - b.x);

        let line: LayoutLine = [];
        let lineY = 0;
        let lineHeight = 0;
        for (const item of visible) {
            const tolerance =
                SAME_LINE_RATIO * Math.min(item.height, lineHeight);
            if (line.length > 0 && Math.abs(item.y - lineY) <= tolerance) {
                line.push(item);
                continue;
            }
            if (line.length > 0) lines.push(line.sort((a, b) => a.x - b.x));
            line = [item];
            lineY = item.y;
            lineHeight = item.height;
        }
        if (line.length > 0) lines.push(line.sort((a, b) => a.x - b.x));
    }
    return lines;
}

export function gapBetween(left: TextItem, right: TextItem): number {
    return right.x - (left.x + left.width);
}

export function isSpaced(left: TextItem, right: TextItem): boolean {
    return (
        /\s$/.test(left.str) ||
        /^\s/.test(right.str) ||
        gapBetween(left, right) >= SPACE_GAP_RATIO * left.height
    );
}

export function lineText(line: LayoutLine): string {
    let text = "";
    line.forEach((item, i) => {
        const prev = line[i - 1];
        if (prev && isSpaced(prev, item)) text += " ";
        text += item.str;
    });
    return text;
}

export function buildLayoutText(lines: LayoutLine[]): string {
    return lines.map(lineText).join("\n");
}
