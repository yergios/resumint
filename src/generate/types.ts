import type { Logger } from "../logging/types.js";

export type OutputFormat = "pdf" | "html" | "both";

export interface Variant {
    name: string;
    language?: string;
}

export interface ResumeMetadata {
    variants?: (string | Variant)[];
    metadata?: { template?: string };
}

export interface CommandLineArgs {
    input: string;
    templatePath: string | undefined;
    outputPath: string;
    variant: string | undefined;
    name: string | undefined;
    browserPath: string | undefined;
    format: OutputFormat;
    skipSpellCheck: boolean;
    verbose: boolean;
}

export interface GenerationResult {
    variant: Variant;
    outputDir: string;
    baseFileName: string;
    html: string;
    success: boolean;
    logger: Logger;
}
