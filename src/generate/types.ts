import type { Logger } from "../logging/types.js";

export interface ResumeMetadata {
    languages?: string[];
    metadata?: { template?: string };
}

export interface CommandLineArgs {
    input: string;
    templatePath: string | undefined;
    outputPath: string;
    language: string | undefined;
    filename: string | undefined;
    browserPath: string | undefined;
    keepHtml: boolean;
    noPdf: boolean;
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
