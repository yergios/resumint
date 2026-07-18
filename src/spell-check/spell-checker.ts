import type { Logger } from "../logging/types.js";
import type { Variant } from "../generate/types.js";
import { getErrorMessage } from "../utils.js";
import { loadDictionary } from "./dictionary.js";
import type { SpellCheckResult } from "./types.js";

function extractText(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanWord(word: string): string {
    return word.replace(
        /^[.,!?;:()[\]{}\-—–""'']+|[.,!?;:()[\]{}\-—–""'']+$/g,
        ""
    );
}

function shouldSkip(word: string): boolean {
    return (
        /[0-9]/.test(word) ||
        !/[a-zA-ZÀ-ž]/.test(word) ||
        cleanWord(word).length <= 1
    );
}

export async function spellCheckHtml(
    html: string,
    language: string,
    logger?: Logger
): Promise<SpellCheckResult> {
    try {
        const dictT = performance.now();
        const spell = await loadDictionary(language, logger);
        logger?.perf("Dictionary load", performance.now() - dictT);

        const scanT = performance.now();
        const words = extractText(html).split(/\s+/).filter(Boolean);
        const misspelled: string[] = [];
        // Check each distinct word once. Suggestions are intentionally not
        // computed: nspell's suggest() dominates the scan and isn't used.
        const checked = new Set<string>();

        for (const rawWord of words) {
            if (shouldSkip(rawWord)) continue;
            const cleanedWord = cleanWord(rawWord);
            if (checked.has(cleanedWord)) continue;
            checked.add(cleanedWord);
            if (!spell.correct(cleanedWord)) {
                misspelled.push(rawWord);
            }
        }
        logger?.perf("Word scan", performance.now() - scanT);

        return { language, misspelledCount: misspelled.length, misspelled };
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        (logger ?? console).error(`Spell check error: ${errorMessage}`);
        return {
            language,
            misspelledCount: 0,
            misspelled: [],
            error: errorMessage
        };
    }
}

export async function runSpellCheck(
    html: string,
    variant: Variant,
    logger: Logger
): Promise<void> {
    if (!variant.language) return;

    const t = performance.now();

    const result = await spellCheckHtml(html, variant.language, logger);
    logger.perf("Spell check", performance.now() - t);

    if (result.misspelledCount > 0) {
        logger.warn(`Found ${result.misspelledCount} misspelled words:`);
        result.misspelled.forEach((word) => {
            logger.warn(`\t- "${word}"`);
        });
    } else {
        logger.info("No spelling errors found");
    }
}
