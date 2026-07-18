import type { Logger } from "../logging/types.js";
import type { Variant } from "../generate/types.js";
import { getErrorMessage } from "../utils.js";
import { loadDictionary } from "./dictionary.js";
import type { MisspelledWord, SpellCheckResult } from "./types.js";

const MAX_SUGGESTIONS = 5;

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
        const spell = await loadDictionary(language, logger);
        const words = extractText(html).split(/\s+/).filter(Boolean);
        const misspelled: MisspelledWord[] = [];

        for (const rawWord of words) {
            if (shouldSkip(rawWord)) continue;
            const cleanedWord = cleanWord(rawWord);
            if (!spell.correct(cleanedWord)) {
                misspelled.push({
                    word: rawWord,
                    cleanedWord,
                    suggestions: spell
                        .suggest(cleanedWord)
                        .slice(0, MAX_SUGGESTIONS)
                });
            }
        }

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

    const result = await spellCheckHtml(html, variant.language);
    logger.perf(
        `Spell check for variant '${variant.name}'`,
        performance.now() - t
    );

    if (result.misspelledCount > 0) {
        logger.warn(
            `Found ${result.misspelledCount} misspelled words in '${variant.name}' resume:`
        );
        result.misspelled.forEach(({ word, suggestions }) => {
            logger.warn(
                `\t- "${word}" -> Suggestions: ${suggestions.join(", ")}`
            );
        });
    } else {
        logger.info(`No spelling errors found in '${variant.name}' resume`);
    }
}
