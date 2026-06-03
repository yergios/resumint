import { ANSI, type LogEntry, type Logger, LogLevel } from "./types.js";

export function createLogger(): Logger {
    const logs: LogEntry[] = [];

    return {
        debug(message: string): void {
            logs.push({
                level: LogLevel.Debug,
                message,
                timestamp: new Date()
            });
        },

        perf(label: string, ms: number): void {
            logs.push({
                level: LogLevel.Perf,
                message: `${label}: ${ms.toFixed(2)}ms`,
                timestamp: new Date()
            });
        },

        info(message: string): void {
            logs.push({ level: LogLevel.Info, message, timestamp: new Date() });
        },

        warn(message: string): void {
            logs.push({ level: LogLevel.Warn, message, timestamp: new Date() });
        },

        error(message: string): void {
            logs.push({
                level: LogLevel.Error,
                message,
                timestamp: new Date()
            });
        },

        print(threshold: number): void {
            for (const entry of logs) {
                if (entry.level.value >= threshold) {
                    entry.level.consoleFn(
                        `${entry.level.color}[${entry.level.label}]${ANSI.white}: ${entry.message}`
                    );
                }
            }
        }
    };
}
