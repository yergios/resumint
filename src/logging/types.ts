export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
}

export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    perf(label: string, ms: number): void;
    getEntries(): LogEntry[];
    getErrors(): string[];
    hasErrors(): boolean;
}
