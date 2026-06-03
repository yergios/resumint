import type { LogEntry, Logger } from "./types.js";

export function createLogger(): Logger {
    const logs: LogEntry[] = [];

    return {
        info(message: string): void {
            logs.push({ level: "info", message, timestamp: new Date() });
        },

        perf(label: string, ms: number): void {
            logs.push({
                level: "perf",
                message: `${label}: ${ms.toFixed(1)}ms`,
                timestamp: new Date()
            });
        },

        warn(message: string): void {
            logs.push({ level: "warn", message, timestamp: new Date() });
        },

        error(message: string): void {
            logs.push({ level: "error", message, timestamp: new Date() });
        },

        print(printDebugLogs: boolean): void {
            for (const entry of logs) {
                if (
                    printDebugLogs ||
                    entry.level === "error" ||
                    entry.level === "warn"
                ) {
                    console.log(`[${entry.level}]: ${entry.message}`);
                }
            }
        }
    };
}
