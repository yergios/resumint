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
