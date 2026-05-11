export type LocalizedString = Record<string, string>;

export interface ContactInfo {
    type: string;
    value: string;
}

export interface DateRange {
    start?: LocalizedString;
    end?: LocalizedString;
}

export interface Position {
    position: LocalizedString;
    date: DateRange;
    techStack?: string[];
    responsibilities: Record<string, string[]>;
}

export interface Experience {
    company: string | LocalizedString;
    location: LocalizedString;
    positions: Position[];
}

export interface Education {
    institution: LocalizedString;
    degree: LocalizedString;
    location: LocalizedString;
    date: DateRange;
}

export interface ResumeData {
    languages: string[];
    basic: {
        name: string;
        title: LocalizedString;
        location: LocalizedString;
        contactInfo: ContactInfo[];
        profileImage?: string;
    };
    experience: Experience[];
    education: Education[];
    metadata: {
        template?: string;
        sections: Record<string, Record<string, string>>;
    };
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

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
}

export interface GenerationResult {
    language: string;
    templateName: string;
    outputDir: string;
    baseFileName: string;
    html: string;
    logs: LogEntry[];
    errors: string[];
    success: boolean;
    metadata: {
        generationTime?: Date;
        spellCheckEnabled: boolean;
    };
}
