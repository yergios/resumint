import type { Logger } from "../logging/types.js";

export interface Variant {
    name: string;
    language?: string;
}

export interface ResumeMetadata {
    variants?: (string | Variant)[];
}

export interface GenerationResult {
    variant: Variant;
    resumeBasename: string;
    outputPath: string;
    html: string;
    logger: Logger;
}
