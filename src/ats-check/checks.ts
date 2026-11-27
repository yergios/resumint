import { buildLayoutText, isSpaced } from "./extract.js";
import type { Finding, LayoutLine, PageItems } from "./types.js";

// What the browser actually showed: the reference the PDF text is held to.
// `units` are the visible text nodes in DOM order; `fullText` is the page's
// innerText, which keeps the real spacing between adjacent nodes.
export interface RenderedText {
    units: string[];
    fullText: string;
}

export interface Reading {
    name: string;
    text: string;
}

// Case is folded because CSS text-transform changes what lands in the PDF
// ("Experience" renders as "EXPERIENCE") without changing what a parser reads.
// Uppercasing first applies the same length-changing mappings CSS uppercase
// does, so "Straße" and the PDF's "STRASSE" fold to the same text.
export function normalize(text: string): string {
    return text
        .replace(/\u00ad/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase()
        .toLowerCase();
}

function hasWordCharacter(text: string): boolean {
    return /[\p{L}\p{N}]/u.test(text);
}

// Units worth checking: separators like "—" or "|" carry no content.
export function contentUnits(units: string[]): string[] {
    return units.map(normalize).filter(hasWordCharacter);
}

function quote(text: string, max = 60): string {
    const flat = text.replace(/\s+/g, " ").trim();
    return `"${flat.length > max ? `${flat.slice(0, max - 1)}…` : flat}"`;
}

function countBefore(haystack: string, needle: string, end: number): number {
    let count = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1 && index < end) {
        count++;
        index = haystack.indexOf(needle, index + 1);
    }
    return count;
}

function nthIndexOf(haystack: string, needle: string, n: number): number {
    let index = -1;
    for (let i = 0; i <= n; i++) {
        index = haystack.indexOf(needle, index + 1);
        if (index === -1) return -1;
    }
    return index;
}

export function checkMissing(units: string[], readings: Reading[]): Finding[] {
    const findings: Finding[] = [];
    for (const unit of new Set(units)) {
        const missingIn = readings
            .filter((reading) => !reading.text.includes(unit))
            .map((reading) => reading.name);
        if (missingIn.length > 0) {
            findings.push({
                kind: "missing",
                message: `${quote(unit)} not found in the ${missingIn.join(" and ")} reading`
            });
        }
    }
    return findings;
}

// Indices of a longest strictly increasing subsequence of `values`.
function longestIncreasing(values: number[]): Set<number> {
    const tails: number[] = [];
    const previous: number[] = new Array(values.length).fill(-1);
    values.forEach((value, i) => {
        let low = 0;
        let high = tails.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (values[tails[mid]] < value) low = mid + 1;
            else high = mid;
        }
        if (low > 0) previous[i] = tails[low - 1];
        tails[low] = i;
    });
    const kept = new Set<number>();
    let i = tails.length > 0 ? tails[tails.length - 1] : -1;
    while (i !== -1) {
        kept.add(i);
        i = previous[i];
    }
    return kept;
}

// Each unit is located in the reading by occurrence count, so a repeated
// value ("San Francisco, USA" in both the header and a job) is matched to its
// own copy. Occurrences are counted in the joined page text, not per unit, so
// a short unit that also appears inside longer ones ("go" in "google") still
// lines up. Units outside the longest in-order run are the ones read out of
// place; using that run keeps one moved block from flagging everything after.
// The reference is DOM order, the order the template writes things in. When a
// unit containing a short one is itself moved, the short unit can be matched
// to the wrong copy and flagged too; that only adds noise to a real finding.
export function checkOrder(units: string[], reading: Reading): Finding[] {
    const expected = units.join(" ");
    const located: { unit: string; position: number }[] = [];
    let offset = 0;
    for (const unit of units) {
        offset = expected.indexOf(unit, offset);
        const occurrence = countBefore(expected, unit, offset);
        const position = nthIndexOf(reading.text, unit, occurrence);
        // Missing units are reported by checkMissing, not as order problems.
        if (position !== -1) located.push({ unit, position });
        offset += unit.length;
    }

    const kept = longestIncreasing(located.map(({ position }) => position));
    return located
        .filter((_, i) => !kept.has(i))
        .map(({ unit }) => ({
            kind: "order" as const,
            message: `${quote(unit)} is read out of order in the ${reading.name} reading`
        }));
}

// Parsers usually take the candidate's name from the first line of text.
export function checkFirstLine(
    units: string[],
    lines: LayoutLine[]
): Finding[] {
    const first = units[0];
    const firstLine = lines[0];
    if (!first || !firstLine) return [];
    const lineText = normalize(buildLayoutText([firstLine]));
    if (lineText.startsWith(first)) return [];
    if (first.startsWith(lineText)) {
        return [
            {
                kind: "order",
                message: `${quote(first)} is split across lines; parsers usually take the name from the first line only`
            }
        ];
    }
    return [
        {
            kind: "order",
            message: `The first line reads ${quote(lineText)} instead of starting with ${quote(first)}; parsers usually take the name from the first line`
        }
    ];
}

// Flags neighbors on a visual line that sit too close to get a space between
// them, unless the page itself shows them joined (a word split across spans).
export function checkMerged(
    lines: LayoutLine[],
    rendered: RenderedText
): Finding[] {
    const shown = normalize(rendered.fullText);
    const findings: Finding[] = [];
    for (const line of lines) {
        line.forEach((right, i) => {
            const left = line[i - 1];
            if (!left || isSpaced(left, right)) return;
            const tail = left.str.split(/\s+/).pop() ?? "";
            const head = right.str.split(/\s+/)[0] ?? "";
            const joined = normalize(tail + head);
            if (shown.includes(joined)) return;
            findings.push({
                kind: "merged",
                message: `${quote(left.str)} and ${quote(right.str)} run together as ${quote(tail + head)}`
            });
        });
    }
    return findings;
}

function describeCharacter(code: number): string | undefined {
    if (code >= 0xfb00 && code <= 0xfb06) return "ligature glyph";
    if (code >= 0xe000 && code <= 0xf8ff) return "private-use glyph";
    if (code === 0xfffd) return "replacement character";
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
        return "control character";
    }
    return undefined;
}

export function checkGarbled(pages: PageItems[]): Finding[] {
    const reported = new Set<number>();
    const findings: Finding[] = [];
    for (const items of pages) {
        for (const item of items) {
            for (const char of item.str) {
                const code = char.codePointAt(0) ?? 0;
                const kind = describeCharacter(code);
                if (!kind || reported.has(code)) continue;
                reported.add(code);
                const hex = code.toString(16).toUpperCase().padStart(4, "0");
                findings.push({
                    kind: "garbled",
                    message: `${kind} U+${hex} in ${quote(item.str)}; parsers may not map it back to letters`
                });
            }
        }
    }
    return findings;
}

const ENGLISH_MONTHS = new Set([
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "sept",
    "oct",
    "nov",
    "dec",
    "january",
    "february",
    "march",
    "april",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
]);
const ONGOING_WORDS = new Set(["present", "current", "now"]);

const YEAR = "(?:19|20)\\d{2}";
const MONTH_YEAR = new RegExp(`^(?:(\\p{L}+)\\.?\\s+)?(${YEAR})$`, "u");
// Numeric dates must contain a plausible year, so phone numbers, GPAs and
// version numbers ("555-123-4567", "3.8/4", "1.2.3") are not mistaken for one.
const NUMERIC_DATE = new RegExp(
    `^(?:\\d{1,2}[/.-]){1,2}${YEAR}$|^${YEAR}[/.-]\\d{1,2}(?:[/.-]\\d{1,2})?$`
);
const SAFE_NUMERIC = new RegExp(`^(?:0[1-9]|1[0-2])/${YEAR}$`);
// Spaced dashes, unspaced en/em dashes, and a bare hyphen right after a year
// when a month word or another year follows ("2015-2019", "2020-Present").
// "2020-01" stays whole: a year-month date, not a range.
const RANGE_SEPARATOR = new RegExp(
    `\\s+[-–—]\\s+|\\s*[–—]\\s*|(?<=${YEAR})-(?=\\p{L}|${YEAR}$|\\d{1,2}/${YEAR}$)`,
    "u"
);
// "June 2028 (expected)" or "present." should be judged on the date itself.
const TRAILING_NOTE = /\s*\([^)]*\)$|[.,;:]+$/;

type DatePart = "safe" | "unsafe" | "not-a-date";

function classifyDatePart(part: string): DatePart {
    if (SAFE_NUMERIC.test(part)) return "safe";
    if (NUMERIC_DATE.test(part)) return "unsafe";
    const match = MONTH_YEAR.exec(part);
    if (!match) return "not-a-date";
    const month = match[1];
    if (!month) return "safe";
    return ENGLISH_MONTHS.has(month.toLowerCase()) ? "safe" : "unsafe";
}

// Only units that are a date or a date range on their own are considered, so
// prose like "Led the migration since 2019" is left alone. A lone "word year"
// ("Office 2019", "Since 2019") is only judged as a date inside a range, where
// the separator makes the intent clear.
export function checkDates(units: string[]): Finding[] {
    const findings: Finding[] = [];
    for (const unit of new Set(
        units.map((u) => u.replace(/\s+/g, " ").trim())
    )) {
        const parts = unit
            .split(RANGE_SEPARATOR)
            .map((part) => part.replace(TRAILING_NOTE, ""));
        if (parts.length > 2) continue;
        const [start, end] = parts as [string, string | undefined];
        const startKind = classifyDatePart(start);
        if (startKind === "not-a-date") continue;
        const isRange = end !== undefined;
        if (!isRange && !NUMERIC_DATE.test(start) && /\p{L}/u.test(start)) {
            continue;
        }

        const problems: string[] = [];
        if (startKind === "unsafe") problems.push(quote(start));
        if (isRange) {
            const endKind = classifyDatePart(end);
            const ongoing = ONGOING_WORDS.has(end.toLowerCase());
            if (endKind === "unsafe") problems.push(quote(end));
            else if (endKind === "not-a-date" && !ongoing) {
                const hint = /\d/.test(end) ? "" : " (use Present)";
                problems.push(`${quote(end)}${hint}`);
            }
        }
        if (problems.length === 0) continue;
        findings.push({
            kind: "date",
            message: `${quote(unit)} may not parse: ${problems.join(", ")}; use MM/YYYY or an English month like "Jan 2022"`
        });
    }
    return findings;
}

export function runChecks(
    rendered: RenderedText,
    pages: PageItems[],
    streamText: string,
    lines: LayoutLine[]
): Finding[] {
    const units = contentUnits(rendered.units);
    const stream: Reading = { name: "stream", text: normalize(streamText) };
    const layout: Reading = {
        name: "layout",
        text: normalize(buildLayoutText(lines))
    };
    return [
        ...checkMissing(units, [stream, layout]),
        ...checkMerged(lines, rendered),
        ...checkFirstLine(units, lines),
        ...checkOrder(units, stream),
        ...checkOrder(units, layout),
        ...checkGarbled(pages),
        ...checkDates(rendered.units)
    ];
}
