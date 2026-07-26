import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
// @ts-expect-error - nspell has no type definitions
import nspell from "nspell";
import { getErrorMessage } from "../utils.js";

const DICTIONARIES_DIR = "workspace/dictionaries";

// Sink for the handful of load-time notices (missing dictionary, read errors).
// The caller (a worker) collects these and replays them on the main thread's
// scoped logger, so dictionary code stays decoupled from the logging module.
type MessageSink = (level: "info" | "error", message: string) => void;

function report(
    sink: MessageSink | undefined,
    level: "info" | "error",
    message: string
): void {
    if (sink) sink(level, message);
    else if (level === "error") console.error(message);
    else console.info(message);
}

export interface SpellInstance {
    correct(word: string): boolean;
    add(word: string): void;
}

// A whitelist file applies to a language when it has no language suffix
// (whitelist.txt — shared across languages) or its suffix matches the language
// (whitelist-en.txt for "en").
export function whitelistAppliesTo(
    fileName: string,
    language: string
): boolean {
    const langMatch = fileName.match(/^.*-([a-z]{2})\.txt$/);
    return !langMatch || langMatch[1] === language;
}

const dictionaryCache: Record<string, Promise<SpellInstance>> = {};

async function addWhitelistedTerms(
    spell: SpellInstance,
    language: string,
    sink?: MessageSink
): Promise<void> {
    const whitelistDir = join(process.cwd(), DICTIONARIES_DIR);
    if (!existsSync(whitelistDir)) return;

    try {
        const files = await readdir(whitelistDir);
        for (const file of files.filter((f) => f.endsWith(".txt"))) {
            if (!whitelistAppliesTo(file, language)) continue;

            const content = readFileSync(join(whitelistDir, file), "utf8");
            for (const line of content.split("\n")) {
                const term = line.trim().toLowerCase();
                if (term && !term.startsWith("#")) {
                    spell.add(term);
                }
            }
        }
    } catch (error) {
        const msg = `Error loading whitelist: ${getErrorMessage(error)}`;
        report(sink, "error", msg);
    }
}

export function loadDictionary(
    language: string,
    sink?: MessageSink
): Promise<SpellInstance> {
    // Cache the in-flight promise, not the resolved instance: variants run
    // concurrently, so two sharing a language would otherwise both pass the
    // empty-cache check before either finished building, and each would rebuild
    // the dictionary and re-apply its whitelist. Storing the promise up front,
    // before the first await, collapses them onto a single build.
    const cached = dictionaryCache[language];
    if (cached) return cached;

    const built = buildDictionary(language, sink);
    dictionaryCache[language] = built;
    return built;
}

async function buildDictionary(
    language: string,
    sink?: MessageSink
): Promise<SpellInstance> {
    const dictionariesDir = join(process.cwd(), DICTIONARIES_DIR);

    try {
        const files = await readdir(dictionariesDir);
        const dicFile = `${language}.dic`;
        const affFile = `${language}.aff`;

        if (files.includes(dicFile) && files.includes(affFile)) {
            const dic = readFileSync(join(dictionariesDir, dicFile), "utf8");
            const aff = readFileSync(join(dictionariesDir, affFile), "utf8");
            const spell = nspell(aff, dic) as SpellInstance;
            await addWhitelistedTerms(spell, language, sink);
            return spell;
        }
    } catch (error) {
        const msg = `Error loading dictionary for ${language}: ${getErrorMessage(error)}`;
        report(sink, "error", msg);
    }

    const notFoundMsg = `No dictionary found for '${language}', all words will pass spell check`;
    report(sink, "info", notFoundMsg);

    return {
        correct: () => true,
        add: () => {}
    };
}
