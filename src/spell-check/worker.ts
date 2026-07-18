// Runs on a worker thread (one per variant). It does the CPU-bound spell-check
// work — building the dictionary and scanning the text — off the main thread,
// so variants check in parallel and don't stall page navigation. Timings and
// notices are posted back for the main thread to log on the scoped logger.
import { parentPort, workerData } from "node:worker_threads";
import { getErrorMessage } from "../utils.js";
import { loadDictionary } from "./dictionary.js";
import type {
    SpellCheckInput,
    SpellCheckResponse,
    SpellMessage
} from "./types.js";

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

async function run({
    html,
    language
}: SpellCheckInput): Promise<SpellCheckResponse> {
    const messages: SpellMessage[] = [];
    const sink = (level: "info" | "error", message: string): void => {
        messages.push({ level, message });
    };

    try {
        const dictT = performance.now();
        const spell = await loadDictionary(language, sink);
        const dictMs = performance.now() - dictT;

        const scanT = performance.now();
        const words = extractText(html).split(/\s+/).filter(Boolean);
        const misspelled: string[] = [];
        // Check each distinct word once; a repeated word costs nothing more.
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
        const scanMs = performance.now() - scanT;

        return {
            result: {
                language,
                misspelledCount: misspelled.length,
                misspelled
            },
            dictMs,
            scanMs,
            messages
        };
    } catch (error) {
        return {
            result: {
                language,
                misspelledCount: 0,
                misspelled: [],
                error: getErrorMessage(error)
            },
            dictMs: 0,
            scanMs: 0,
            messages
        };
    }
}

run(workerData as SpellCheckInput).then((response) => {
    parentPort?.postMessage(response);
});
