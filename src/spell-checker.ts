// @ts-expect-error - nspell has no type definitions
import nspell from "nspell";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { readdir } from "fs/promises";
import { getErrorMessage } from "./utils.js";

const DICTIONARIES_DIR = "dictionaries";
const WHITELIST_DIR = "whitelist";
const MAX_SUGGESTIONS = 5;

interface SpellInstance {
  correct(word: string): boolean;
  suggest(word: string): string[];
  add(word: string): void;
}

export interface MisspelledWord {
  word: string;
  cleanedWord: string;
  suggestions: string[];
}

export interface SpellCheckResult {
  language: string;
  misspelledCount: number;
  misspelled: MisspelledWord[];
  error?: string;
}

const dictionaryCache: Record<string, SpellInstance> = {};

async function addWhitelistedTerms(spell: SpellInstance, language: string): Promise<void> {
  const whitelistDir = join(process.cwd(), DICTIONARIES_DIR, WHITELIST_DIR);
  if (!existsSync(whitelistDir)) return;

  try {
    const files = await readdir(whitelistDir);
    for (const file of files.filter((f) => f.endsWith(".txt"))) {
      const langMatch = file.match(/^.*-([a-z]{2})\.txt$/);
      if (langMatch && langMatch[1] !== language) continue;

      const content = readFileSync(join(whitelistDir, file), "utf8");
      content
        .split("\n")
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term && !term.startsWith("#"))
        .forEach((term) => spell.add(term));
    }
  } catch (error) {
    console.error(`Error loading whitelist: ${getErrorMessage(error)}`);
  }
}

async function loadDictionary(language: string): Promise<SpellInstance> {
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
      await addWhitelistedTerms(spell, language);
      dictionaryCache[language] = spell;
      return spell;
    }
  } catch (error) {
    console.error(`Error loading dictionary for ${language}: ${getErrorMessage(error)}`);
  }

  console.log(`No dictionary found for '${language}', all words will pass spell check`);
  const dummy: SpellInstance = { correct: () => true, suggest: () => [], add: () => {} };
  dictionaryCache[language] = dummy;
  return dummy;
}

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
  return word.replace(/^[.,!?;:()[\]{}\-—–""'']+|[.,!?;:()[\]{}\-—–""'']+$/g, "");
}

function shouldSkip(word: string): boolean {
  return /[0-9]/.test(word) || !/[a-zA-ZÀ-ž]/.test(word) || cleanWord(word).length <= 1;
}

export async function spellCheckHtml(html: string, language: string): Promise<SpellCheckResult> {
  try {
    const spell = await loadDictionary(language);
    const words = extractText(html).split(/\s+/).filter(Boolean);
    const misspelled: MisspelledWord[] = [];

    for (const rawWord of words) {
      if (shouldSkip(rawWord)) continue;
      const cleanedWord = cleanWord(rawWord);
      if (!spell.correct(cleanedWord)) {
        misspelled.push({
          word: rawWord,
          cleanedWord,
          suggestions: spell.suggest(cleanedWord).slice(0, MAX_SUGGESTIONS)
        });
      }
    }

    return { language, misspelledCount: misspelled.length, misspelled };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`Spell check error: ${errorMessage}`);
    return { language, misspelledCount: 0, misspelled: [], error: errorMessage };
  }
}

export default { spellCheckHtml };
