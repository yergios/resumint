import assert from "node:assert/strict";
import { test } from "node:test";
import {
    checkDates,
    checkFirstLine,
    checkGarbled,
    checkMerged,
    checkMissing,
    checkOrder,
    contentUnits,
    normalize
} from "../src/ats-check/checks.js";
import {
    buildLayoutLines,
    buildLayoutText,
    buildStreamText,
    lineText
} from "../src/ats-check/extract.js";
import type { TextItem } from "../src/ats-check/types.js";

// Width is approximated as 5 units per character at height 10.
function item(str: string, x: number, y: number, height = 10): TextItem {
    return { str, x, y, width: str.length * 5, height, hasEOL: false };
}

// --- normalize / contentUnits ---

test("normalize folds case, whitespace and soft hyphens", () => {
    assert.equal(normalize("  EXPE­RIENCE \n Now "), "experience now");
});

test("contentUnits drops separator-only units", () => {
    assert.deepEqual(contentUnits(["John", "—", "|", "2022"]), [
        "john",
        "2022"
    ]);
});

// --- layout reconstruction ---

test("items on one baseline form one line, sorted left to right", () => {
    const lines = buildLayoutLines([
        [item("right", 200, 700), item("left", 0, 700)]
    ]);
    assert.equal(lines.length, 1);
    assert.equal(lineText(lines[0] ?? []), "left right");
});

test("baselines within half the font height share a line", () => {
    const lines = buildLayoutLines([
        [item("Company", 0, 700, 10.5), item("City", 300, 701.5, 9)]
    ]);
    assert.equal(lines.length, 1);
});

test("separate baselines form separate lines, top first", () => {
    const text = buildLayoutText(
        buildLayoutLines([[item("second", 0, 680), item("first", 0, 700)]])
    );
    assert.equal(text, "first\nsecond");
});

test("whitespace-only items are dropped from layout lines", () => {
    const lines = buildLayoutLines([
        [item("a", 0, 700), item("   ", 5, 700), item("b", 100, 700)]
    ]);
    assert.equal(lines[0]?.length, 2);
});

test("a tight gap joins items without a space", () => {
    const lines = buildLayoutLines([
        [item("abc", 0, 700), item("def", 16, 700)]
    ]);
    assert.equal(lineText(lines[0] ?? []), "abcdef");
});

test("stream text follows content order and end-of-line flags", () => {
    const first = { ...item("one", 0, 700), hasEOL: true };
    assert.equal(buildStreamText([[first, item("two", 0, 600)]]), "one\ntwo\n");
});

// --- checkMissing ---

test("reports a unit absent from a reading", () => {
    const findings = checkMissing(
        ["john doe", "jane"],
        [
            { name: "stream", text: "john doe jane" },
            { name: "layout", text: "john doe" }
        ]
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0]?.message ?? "", /"jane" not found in the layout/);
});

// --- checkOrder ---

test("no findings when the reading keeps DOM order", () => {
    const units = ["email", "web", "phone"];
    assert.deepEqual(
        checkOrder(units, { name: "layout", text: "email web phone" }),
        []
    );
});

test("flags units displaced by a column-flowed grid", () => {
    // DOM order down the columns, read across the rows.
    const units = ["email", "web", "phone", "github", "city", "linkedin"];
    const text = "email phone city web github linkedin";
    const findings = checkOrder(units, { name: "layout", text });
    assert.equal(findings.length, 2);
});

test("repeated values are matched to their own occurrence", () => {
    const units = ["header", "sf", "job", "sf"];
    assert.deepEqual(
        checkOrder(units, { name: "layout", text: "header sf job sf" }),
        []
    );
});

test("a short unit inside a longer one does not shift the match", () => {
    const units = ["google", "go"];
    assert.deepEqual(
        checkOrder(units, { name: "layout", text: "google go" }),
        []
    );
});

// --- checkFirstLine ---

test("flags a first line that doesn't start with the first unit", () => {
    const lines = buildLayoutLines([
        [item("john@x.com", 300, 700), item("Resume", 0, 700)]
    ]);
    assert.equal(checkFirstLine(["john doe"], lines).length, 1);
});

test("accepts a first line starting with the name", () => {
    const lines = buildLayoutLines([[item("John Doe", 0, 700)]]);
    assert.deepEqual(checkFirstLine(["john doe"], lines), []);
});

// --- checkMerged ---

test("flags neighbors that run together", () => {
    const lines = buildLayoutLines([
        [item("john@x.com", 0, 700), item("+1 555", 50, 700)]
    ]);
    const findings = checkMerged(lines, {
        units: ["john@x.com", "+1 555"],
        fullText: "john@x.com\n+1 555"
    });
    assert.equal(findings.length, 1);
    assert.match(findings[0]?.message ?? "", /"john@x.com\+1"/);
});

test("allows spans the page itself shows joined", () => {
    const lines = buildLayoutLines([
        [item("Jan", 0, 700), item("2022", 15, 700)]
    ]);
    const findings = checkMerged(lines, {
        units: ["Jan", "2022"],
        fullText: "Jan2022"
    });
    assert.deepEqual(findings, []);
});

// --- checkGarbled ---

test("flags ligatures, private-use glyphs and replacement characters once", () => {
    const findings = checkGarbled([
        [item("ﬁrst ﬁx", 0, 700), item("icon ", 0, 680), item("bad �", 0, 660)]
    ]);
    assert.equal(findings.length, 3);
});

test("plain text has no garbled findings", () => {
    assert.deepEqual(checkGarbled([[item("Café — naïve", 0, 700)]]), []);
});

// --- checkDates ---

test("accepts MM/YYYY, English months, bare years and ongoing words", () => {
    assert.deepEqual(
        checkDates([
            "01/2020 — 12/2021",
            "Jan 2022 — Present",
            "September 2019 - Current",
            "Sept. 2018 – Now",
            "2015"
        ]),
        []
    );
});

test("warns on localized months and non-English ongoing words", () => {
    const findings = checkDates(["ene 2022 — Actualidad"]);
    assert.equal(findings.length, 1);
    assert.match(findings[0]?.message ?? "", /"ene 2022"/);
    assert.match(findings[0]?.message ?? "", /"Actualidad" \(use Present\)/);
});

test("warns on ambiguous numeric dates", () => {
    assert.equal(checkDates(["2020-01 — 1/2021"]).length, 1);
    assert.equal(checkDates(["03.04.2020"]).length, 1);
});

test("ignores prose that merely contains a year", () => {
    assert.deepEqual(checkDates(["Led the migration since 2019"]), []);
});
