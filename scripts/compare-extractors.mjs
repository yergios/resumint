// Manual cross-check of the ATS check's pdfjs readings against poppler's
// pdftotext, an independent extractor. Differences point either at a flaw in
// our layout reconstruction or at a layout real parsers will disagree on.
//
// Usage: pnpm build && pnpm ats:compare <file.pdf>
// Needs pdftotext (poppler-utils) and diff on the PATH; not shipped or tested.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    buildLayoutLines,
    buildLayoutText,
    buildStreamText,
    extractTextItems
} from "../dist/ats-check/extract.js";

const pdfPath = process.argv[2];
if (!pdfPath) {
    console.error("Usage: pnpm ats:compare <file.pdf>");
    process.exit(1);
}

function pdftotext(args) {
    const result = spawnSync(
        "pdftotext",
        [...args, "-enc", "UTF-8", pdfPath, "-"],
        { encoding: "utf8" }
    );
    if (result.error?.code === "ENOENT") {
        console.error(
            "pdftotext not found. Install poppler-utils (apt) or poppler (brew)."
        );
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(result.stderr);
        process.exit(1);
    }
    return result.stdout;
}

// Spacing and blank lines differ between extractors for harmless reasons;
// compare line content only.
function tidy(text) {
    return text
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .concat("\n");
}

const pages = await extractTextItems(pdfPath);
const pairs = [
    {
        ours: ["pdfjs-stream", buildStreamText(pages)],
        theirs: ["poppler-raw", pdftotext(["-raw"])]
    },
    {
        ours: ["pdfjs-layout", buildLayoutText(buildLayoutLines(pages))],
        theirs: ["poppler-default", pdftotext([])]
    }
];

const dir = mkdtempSync(join(tmpdir(), "resumint-compare-"));
try {
    for (const { ours, theirs } of pairs) {
        const oursPath = join(dir, ours[0]);
        const theirsPath = join(dir, theirs[0]);
        writeFileSync(oursPath, tidy(ours[1]));
        writeFileSync(theirsPath, tidy(theirs[1]));
        const diff = spawnSync(
            "diff",
            [
                "-u",
                "--label",
                ours[0],
                "--label",
                theirs[0],
                oursPath,
                theirsPath
            ],
            { encoding: "utf8" }
        );
        console.log(`=== ${ours[0]} vs ${theirs[0]} ===`);
        console.log(diff.stdout || "identical\n");
    }
} finally {
    rmSync(dir, { recursive: true, force: true });
}
