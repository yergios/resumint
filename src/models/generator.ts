import type { Logger } from "./logger.js";

export interface ResumeMetadata {
    languages?: string[];
    metadata?: { template?: string };
}

export interface CommandLineArgs {
    data: string;
    template: string | undefined;
    templatesDir: string;
    output: string;
    language: string | undefined;
    html: boolean;
    htmlOnly: boolean;
    noSpellCheck: boolean;
    verbose: boolean;
}

export interface GenerationResult {
    language: string;
    templateName: string;
    outputDir: string;
    baseFileName: string;
    html: string;
    success: boolean;
    logger: Logger;
}
