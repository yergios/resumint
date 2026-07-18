import { ANSI, type LogEntry, type Logger, LogLevel } from "./types.js";

export function createLogger(): Logger {
    return makeLogger([], undefined);
}

// All child loggers share the root's `logs` buffer; `variant` is stamped onto
// every entry they push so `print` can group them.
function makeLogger(logs: LogEntry[], variant: string | undefined): Logger {
    function add(level: LogEntry["level"], message: string): void {
        logs.push({ level, message, timestamp: new Date(), variant });
    }

    return {
        debug(message: string): void {
            add(LogLevel.Debug, message);
        },

        perf(label: string, ms: number): void {
            add(LogLevel.Perf, `${label}: ${ms.toFixed(2)}ms`);
        },

        info(message: string): void {
            add(LogLevel.Info, message);
        },

        warn(message: string): void {
            add(LogLevel.Warn, message);
        },

        error(message: string): void {
            add(LogLevel.Error, message);
        },

        forVariant(name: string): Logger {
            return makeLogger(logs, name);
        },

        print(threshold: number): void {
            const globals: LogEntry[] = [];
            const byVariant = new Map<string, LogEntry[]>();

            for (const entry of logs) {
                if (entry.level.value < threshold) continue;
                if (entry.variant === undefined) {
                    globals.push(entry);
                    continue;
                }
                const existing = byVariant.get(entry.variant);
                if (existing) {
                    existing.push(entry);
                } else {
                    byVariant.set(entry.variant, [entry]);
                }
            }

            for (const entry of globals) printEntry(entry);

            for (const [name, entries] of byVariant) {
                console.log(`\n=== variant: ${name} ===`);
                for (const entry of entries) printEntry(entry);
            }
        }
    };
}

function printEntry(entry: LogEntry): void {
    entry.level.consoleFn(
        `${entry.level.color}[${entry.level.label}]${ANSI.white}: ${entry.message}`
    );
}
