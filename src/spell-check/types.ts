export interface SpellCheckResult {
    language: string;
    misspelledCount: number;
    misspelled: string[];
    error?: string;
}

// Data passed to a spell-check worker (via workerData).
export interface SpellCheckInput {
    html: string;
    language: string;
}

// A load-time notice the worker forwards for the main thread to log on the
// variant's scoped logger (workers can't touch that logger directly).
export type SpellMessage = { level: "info" | "error"; message: string };

// What a spell-check worker posts back. Timings are measured worker-side and
// logged by the main thread so grouped, per-variant output is preserved.
export interface SpellCheckResponse {
    result: SpellCheckResult;
    dictMs: number;
    scanMs: number;
    messages: SpellMessage[];
}
