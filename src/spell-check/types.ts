export interface SpellCheckResult {
    language: string;
    misspelledCount: number;
    misspelled: string[];
    error?: string;
}
