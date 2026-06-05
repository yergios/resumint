export type OutputFormat = "pdf" | "html" | "both";

export interface CommandLineArgs {
    input: string;
    templatePath: string;
    variant: string | undefined;
    name: string | undefined;
    outputPath: string;
    browserPath: string;
    format: OutputFormat;
    skipSpellCheck: boolean;
    verbose: boolean;
}
