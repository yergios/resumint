export const ANSI = {
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m",
    white: "\x1b[0m"
} as const;

export const LogLevel = {
    Debug: {
        value: 0,
        label: "DEBUG",
        color: ANSI.gray,
        consoleFn: console.log
    },
    Perf: { value: 0, label: "PERF", color: ANSI.gray, consoleFn: console.log },
    Info: {
        value: 1,
        label: "INFO",
        color: ANSI.white,
        consoleFn: console.log
    },
    Warn: {
        value: 2,
        label: "WARN",
        color: ANSI.yellow,
        consoleFn: console.warn
    },
    Error: {
        value: 3,
        label: "ERROR",
        color: ANSI.red,
        consoleFn: console.error
    }
} as const;

export interface LogEntry {
    level: (typeof LogLevel)[keyof typeof LogLevel];
    message: string;
    timestamp: Date;
    variant?: string | undefined;
}

export interface Logger {
    debug(message: string): void;
    perf(label: string, ms: number): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    // Returns a child logger whose entries are tagged with this variant, so
    // concurrent variants can be grouped when printed. Shares the parent buffer.
    forVariant(name: string): Logger;
    print(threshold: number): void;
}
