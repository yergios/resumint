import type { LogEntry, Logger, LogLevel } from "./types.js";

export function createLogger(verbose: boolean): Logger {
    const entries: LogEntry[] = [];
    const errors: string[] = [];

    function log(level: LogLevel, message: string): void {
        entries.push({ level, message, timestamp: new Date() });
        if (verbose || level !== "info") {
            console.log(`[${level.toUpperCase()}]: ${message}`);
        }
    }

    return {
        info(message: string): void {
            log("info", message);
        },

        warn(message: string): void {
            log("warn", message);
        },

        error(message: string): void {
            errors.push(message);
            log("error", message);
        },

        perf(label: string, ms: number): void {
            if (verbose) {
                console.log(`[PERF]: ${label}: ${ms.toFixed(1)}ms`);
            }
        },

        getEntries(): LogEntry[] {
            return entries;
        },

        getErrors(): string[] {
            return errors;
        },

        hasErrors(): boolean {
            return errors.length > 0;
        }
    };
}
