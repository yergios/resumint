import type { Logger } from "../logging/types.js";

export type OutputFormat = "pdf" | "html" | "both";

export interface ResumeMetadata {
    languages?: string[];
    metadata?: { template?: string };
}

export interface CommandLineArgs {
    input: string;
    templatePath: string | undefined;
    outputPath: string;
    language: string | undefined;
    name: string | undefined;
    browserPath: string | undefined;
    format: OutputFormat;
    skipSpellCheck: boolean;
    verbose: boolean;
}

export interface GenerationResult {
    language: string;
    outputDir: string;
    baseFileName: string;
    html: string;
    success: boolean;
    logger: Logger;
}
