import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
// @ts-expect-error - nspell has no type definitions
import nspell from "nspell";
import type { Logger } from "../logging/types.js";
import { getErrorMessage } from "../utils.js";

const DICTIONARIES_DIR = "workspace/dictionaries";

export interface SpellInstance {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): void;
}

const dictionaryCache: Record<string, SpellInstance> = {};

async function addWhitelistedTerms(
    spell: SpellInstance,
    language: string,
    logger?: Logger
): Promise<void> {
    const whitelistDir = join(process.cwd(), DICTIONARIES_DIR);
    if (!existsSync(whitelistDir)) return;

    try {
        const files = await readdir(whitelistDir);
        for (const file of files.filter((f) => f.endsWith(".txt"))) {
            const langMatch = file.match(/^.*-([a-z]{2})\.txt$/);
            if (langMatch && langMatch[1] !== language) continue;

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
        logger?.error(msg) ?? console.error(msg);
    }
}

export async function loadDictionary(
    language: string,
    logger?: Logger
): Promise<SpellInstance> {
    if (dictionaryCache[language]) return dictionaryCache[language];

    const dictionariesDir = join(process.cwd(), DICTIONARIES_DIR);

    try {
        const files = await readdir(dictionariesDir);
        const dicFile = `${language}.dic`;
        const affFile = `${language}.aff`;

        if (files.includes(dicFile) && files.includes(affFile)) {
            const dic = readFileSync(join(dictionariesDir, dicFile), "utf8");
            const aff = readFileSync(join(dictionariesDir, affFile), "utf8");
            const spell = nspell(aff, dic) as SpellInstance;
            await addWhitelistedTerms(spell, language, logger);
            dictionaryCache[language] = spell;
            return spell;
        }
    } catch (error) {
        const msg = `Error loading dictionary for ${language}: ${getErrorMessage(error)}`;
        logger?.error(msg) ?? console.error(msg);
    }

    const notFoundMsg = `No dictionary found for '${language}', all words will pass spell check`;
    logger?.info(notFoundMsg) ?? console.info(notFoundMsg);

    const dummy: SpellInstance = {
        correct: () => true,
        suggest: () => [],
        add: () => {}
    };
    dictionaryCache[language] = dummy;
    return dummy;
}
