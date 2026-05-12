import { existsSync } from "node:fs";
import { platform } from "node:os";

const CANDIDATES: Record<string, string[]> = {
    linux: [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser"
    ],
    darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ],
    win32: [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    ]
};

export function resolveBrowserPath(cliPath?: string): string {
    if (cliPath) {
        if (!existsSync(cliPath)) {
            throw new Error(`--browserPath does not exist: ${cliPath}`);
        }
        return cliPath;
    }

    const envPath = process.env["PUPPETEER_EXECUTABLE_PATH"];
    if (envPath) {
        if (!existsSync(envPath)) {
            throw new Error(
                `PUPPETEER_EXECUTABLE_PATH does not exist: ${envPath}`
            );
        }
        return envPath;
    }

    const candidates = CANDIDATES[platform()] ?? [];
    for (const path of candidates) {
        if (existsSync(path)) return path;
    }

    throw new Error(
        "No Chrome/Chromium found. Install Chrome/Chromium or pass --browserPath /path/to/chrome."
    );
}
