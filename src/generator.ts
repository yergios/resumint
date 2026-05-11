import {
    existsSync,
    mkdirSync,
    readFileSync,
    unlinkSync,
    writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import Handlebars from "handlebars";
import { load as yamlLoad } from "js-yaml";
import { type Browser, launch, type Page } from "puppeteer";
import type {
    CommandLineArgs,
    ContactInfo,
    GenerationResult,
    LogEntry,
    LogLevel,
    ResumeData
} from "./models/generator.js";
import { spellCheckHtml } from "./spell-checker.js";
import { getCurrentDate, getErrorMessage } from "./utils.js";

// A4 at 96 DPI is ~1123px; 1200 gives headroom for subpixel rounding and browser zoom
const A4_HEIGHT_PX = 1200;

const CONTACT_ORDER = [
    "email",
    "web",
    "phone",
    "github",
    "location",
    "linkedin"
];

function createLogEntry(level: LogLevel, message: string): LogEntry {
    return { level, message, timestamp: new Date() };
}

function log(
    generationResult: GenerationResult,
    level: LogLevel,
    message: string,
    verbose: boolean
): void {
    generationResult.logs.push(createLogEntry(level, message));
    if (verbose || level !== "info") {
        console.log(`[${level.toUpperCase()}]: ${message}`);
    }
}

function logPerf(label: string, ms: number, verbose: boolean): void {
    if (verbose) console.log(`[PERF]: ${label}: ${ms.toFixed(1)}ms`);
}

function generateBaseFileName(
    date: string,
    language: string,
    name: string
): string {
    return `${date}-${language}-${name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")}`;
}

function handleGenerationError(
    generationResult: GenerationResult,
    error: string,
    verbose: boolean
): void {
    generationResult.errors.push(error);
    generationResult.success = false;
    log(generationResult, "error", error, verbose);
}

const ICON_SVGS: Record<string, string> = {
    email: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="48" y="96" width="416" height="320" rx="40" ry="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M112 160l144 112 144-112"/></svg>',
    phone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M451 374c-15.88-16-54.34-39.35-73-48.76-24.3-12.24-26.3-13.24-45.4.95-12.74 9.47-21.21 17.93-36.12 14.75s-47.31-21.11-75.68-49.39-47.34-61.62-50.53-76.48 5.41-23.23 14.79-36c13.22-18 12.22-21 .92-45.3-8.81-18.9-32.84-57-48.9-72.8C119.9 44 119.9 47 108.83 51.6A160.15 160.15 0 0083 65.37C67 76 58.12 84.83 51.91 98.1s-9 44.38 23.07 102.64 54.57 88.05 101.14 134.49S258.5 406.64 310.85 436c64.76 36.27 89.6 29.2 102.91 23s22.18-15 32.83-31a159.09 159.09 0 0013.8-25.8C465 391.17 468 391.17 451 374z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/></svg>',
    github: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 32C132.3 32 32 134.9 32 261.7c0 101.5 64.2 187.5 153.2 217.9a17.56 17.56 0 003.8.4c8.3 0 11.5-6.1 11.5-11.4 0-5.5-.2-19.9-.3-39.1a102.4 102.4 0 01-22.6 2.7c-43.1 0-52.9-33.5-52.9-33.5-10.2-26.5-24.9-33.6-24.9-33.6-19.5-13.7-.1-14.1 1.4-14.1h.1c22.5 2 34.3 23.8 34.3 23.8 11.2 19.6 26.2 25.1 39.6 25.1a63 63 0 0025.6-6c2-14.8 7.8-24.9 14.2-30.7-49.7-5.8-102-25.5-102-113.5 0-25.1 8.7-45.6 23-61.6-2.3-5.8-10-29.2 2.2-60.8a18.64 18.64 0 015-.5c8.1 0 26.4 3.1 56.6 24.1a208.21 208.21 0 01112.2 0c30.2-21 48.5-24.1 56.6-24.1a18.64 18.64 0 015 .5c12.2 31.6 4.5 55 2.2 60.8 14.3 16.1 23 36.6 23 61.6 0 88.2-52.4 107.6-102.3 113.3 8 7.1 15.2 21.1 15.2 42.5 0 30.7-.3 55.5-.3 63 0 5.4 3.1 11.5 11.4 11.5a19.35 19.35 0 004-.4C415.9 449.2 480 363.1 480 261.7 480 134.9 379.7 32 256 32z"/></svg>',
    linkedin:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M444.17 32H70.28C49.85 32 32 46.7 32 66.89v374.72C32 461.91 49.85 480 70.28 480h373.78c20.54 0 35.94-18.21 35.94-38.39V66.89C480.12 46.7 464.6 32 444.17 32zm-273.3 373.43h-64.18V205.88h64.18zM141 175.54h-.46c-20.54 0-33.84-15.29-33.84-34.43 0-19.49 13.65-34.42 34.65-34.42s33.85 14.82 34.31 34.42c-.01 19.14-13.31 34.43-34.66 34.43zm264.43 229.89h-64.18V296.32c0-26.14-9.34-44-32.56-44-17.74 0-28.24 12-32.91 23.69-1.75 4.2-2.22 9.92-2.22 15.76v113.66h-64.18V205.88h64.18v27.77c9.34-13.3 23.93-32.44 57.88-32.44 42.13 0 74 27.77 74 87.64z"/></svg>',
    location:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 48c-79.5 0-144 61.39-144 137 0 87 96 224.87 131.25 272.49a15.77 15.77 0 0025.5 0C304 409.89 400 272.07 400 185c0-75.61-64.5-137-144-137z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><circle cx="256" cy="192" r="48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>',
    web: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 48C141.13 48 48 141.13 48 256s93.13 208 208 208 208-93.13 208-208S370.87 48 256 48z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/><path d="M256 48c-58.07 0-112.67 93.13-112.67 208S197.93 464 256 464s112.67-93.13 112.67-208S314.07 48 256 48z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/><path d="M117.33 117.33c38.24 27.15 86.38 43.34 138.67 43.34s100.43-16.19 138.67-43.34M394.67 394.67c-38.24-27.15-86.38-43.34-138.67-43.34s-100.43 16.19-138.67 43.34" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" d="M256 48v416M464 256H48"/></svg>'
};

function setupHandlebars(): void {
    Handlebars.registerHelper("eq", (a, b) => a === b);
    Handlebars.registerHelper("join", (array, separator) =>
        array.join(separator)
    );
    Handlebars.registerHelper("getIconSvg", (type: string) => {
        return new Handlebars.SafeString(ICON_SVGS[type] ?? "");
    });
    Handlebars.registerHelper("lookup", (obj, field, subfield) => {
        if (!obj || !field) return "";
        if (typeof subfield === "string") return obj[field][subfield];
        return obj[field] !== undefined ? obj[field] : obj;
    });
}

async function generatePDF(
    page: Page,
    htmlPath: string,
    outputPath: string,
    generationResult: GenerationResult,
    verbose: boolean
) {
    const absoluteHtmlPath = `file://${resolve(htmlPath)}`;
    await page.goto(absoluteHtmlPath, { waitUntil: "networkidle0" });

    const { contentHeight, containerFound } = await page.evaluate(() => {
        const container = document.querySelector(".resume-container");
        if (!container) {
            return {
                contentHeight: document.body.scrollHeight,
                containerFound: false
            };
        }
        return { contentHeight: container.scrollHeight, containerFound: true };
    });

    if (!containerFound) {
        log(
            generationResult,
            "warn",
            "Resume container not found, using body height",
            verbose
        );
    }

    if (contentHeight > A4_HEIGHT_PX) {
        handleGenerationError(
            generationResult,
            `Content height exceeds A4 maximum (${contentHeight}px exceeds ${A4_HEIGHT_PX}px)`,
            verbose
        );
        return;
    }

    const t = performance.now();
    await page.pdf({
        path: outputPath,
        format: "A4",
        margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
    logPerf(
        `PDF render (${generationResult.language})`,
        performance.now() - t,
        verbose
    );

    log(generationResult, "info", `PDF generated: ${outputPath}`, verbose);
}

async function runSpellCheck(
    html: string,
    language: string,
    generationResult: GenerationResult,
    verbose: boolean
): Promise<void> {
    const t = performance.now();
    const result = await spellCheckHtml(html, language);
    logPerf(`Spell check (${language})`, performance.now() - t, verbose);

    if (result.misspelledCount > 0) {
        log(
            generationResult,
            "warn",
            `Found ${result.misspelledCount} misspelled words in '${language}' resume:`,
            verbose
        );
        result.misspelled.forEach(({ word, suggestions }) => {
            log(
                generationResult,
                "warn",
                `\t- "${word}" -> Suggestions: ${suggestions.join(", ")}`,
                verbose
            );
        });
    } else {
        log(
            generationResult,
            "info",
            `No spelling errors found in ${language} resume`,
            verbose
        );
    }
}

async function generateResumeForLanguage(
    browser: Browser | undefined,
    options: CommandLineArgs,
    generationResult: GenerationResult
) {
    const t = performance.now();
    const { verbose } = options;

    let newPagePromise: Promise<Page> | undefined;
    if (!options.htmlOnly) {
        newPagePromise = browser?.newPage();
    }

    const htmlPath = join(
        generationResult.outputDir,
        `${generationResult.baseFileName}.html`
    );

    const spellCheckPromise = options.noSpellCheck
        ? undefined
        : runSpellCheck(
              generationResult.html,
              generationResult.language,
              generationResult,
              verbose
          );

    writeFileSync(htmlPath, generationResult.html);

    let pdfGenerationPromise: Promise<void> | undefined;
    if (options.htmlOnly) {
        log(generationResult, "info", `HTML saved: ${htmlPath}`, verbose);
    } else {
        const pdfPath = join(
            generationResult.outputDir,
            `${generationResult.baseFileName}.pdf`
        );
        const page = await newPagePromise;
        if (!page) {
            handleGenerationError(
                generationResult,
                "Browser page was not created",
                verbose
            );
            return;
        }
        pdfGenerationPromise = generatePDF(
            page,
            htmlPath,
            pdfPath,
            generationResult,
            verbose
        );
    }

    await spellCheckPromise;
    await pdfGenerationPromise;

    if (!options.html && !options.htmlOnly && generationResult.success) {
        unlinkSync(htmlPath);
    }

    logPerf(
        `Total (${generationResult.language})`,
        performance.now() - t,
        verbose
    );
}

function buildContactInfo(
    resumeData: ResumeData,
    language: string
): ContactInfo[] {
    const locationValue = resumeData.basic.location[language] ?? "";
    return [
        ...resumeData.basic.contactInfo,
        { type: "location", value: locationValue }
    ].sort(
        (a, b) => CONTACT_ORDER.indexOf(a.type) - CONTACT_ORDER.indexOf(b.type)
    );
}

export async function generateResumes(options: CommandLineArgs) {
    try {
        setupHandlebars();

        let browser: Browser | undefined;
        if (!options.htmlOnly) {
            browser = await launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
                ]
            });
        }

        const resumeData: ResumeData = yamlLoad(
            readFileSync(options.data, "utf8")
        ) as ResumeData;
        const templateName =
            options.template ?? resumeData.metadata?.template ?? "default";
        const templatePath = resolve(
            process.cwd(),
            options.templatesDir,
            `${templateName}-template.html`
        );

        if (!existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const outputDir = resolve(process.cwd(), options.output);
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }

        const languages = options.language
            ? [options.language]
            : resumeData.languages;
        if (!languages || languages.length === 0) {
            throw new Error(
                "No languages specified in resume data or via --language"
            );
        }

        const currentDate = getCurrentDate();
        const template = Handlebars.compile(readFileSync(templatePath, "utf8"));
        const totalStart = performance.now();

        await Promise.all(
            languages.map((language) => {
                const contactInfo = buildContactInfo(resumeData, language);
                const generationResult: GenerationResult = {
                    language,
                    templateName,
                    outputDir,
                    baseFileName: generateBaseFileName(
                        currentDate,
                        language,
                        resumeData.basic.name
                    ),
                    html: template({
                        ...resumeData,
                        language,
                        basic: { ...resumeData.basic, contactInfo }
                    }),
                    logs: [],
                    errors: [],
                    success: true,
                    metadata: {
                        generationTime: new Date(),
                        spellCheckEnabled: !options.noSpellCheck
                    }
                };

                log(
                    generationResult,
                    "info",
                    `Generating '${language.toUpperCase()}' resume`,
                    options.verbose
                );
                return generateResumeForLanguage(
                    browser,
                    options,
                    generationResult
                );
            })
        );

        logPerf(
            "Total overall",
            performance.now() - totalStart,
            options.verbose
        );
        await browser?.close();
    } catch (err) {
        console.error(`Error: ${getErrorMessage(err)}`);
        process.exit(1);
    }
}

export default { generateResumes };
