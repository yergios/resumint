import { Worker } from "node:worker_threads";
import type { Variant } from "../generate/types.js";
import type { Logger } from "../logging/types.js";
import { getErrorMessage } from "../utils.js";
import type { SpellCheckResponse } from "./types.js";

// Runs a variant's spell check on its own worker thread and logs the result on
// the variant's scoped logger. A failure is non-fatal: it's logged and the
// promise still resolves so it can't abort the run.
export function runSpellCheck(
    html: string,
    variant: Variant,
    logger: Logger
): Promise<void> {
    if (!variant.language) return Promise.resolve();

    const language = variant.language;
    const t = performance.now();

    return new Promise<void>((resolve) => {
        const worker = new Worker(new URL("./worker.js", import.meta.url), {
            workerData: { html, language }
        });

        worker.once("message", (response: SpellCheckResponse) => {
            worker.terminate();

            for (const { level, message } of response.messages) {
                if (level === "error") logger.error(message);
                else logger.info(message);
            }

            logger.perf("Dictionary load", response.dictMs);
            logger.perf("Word scan", response.scanMs);
            logger.perf("Spell check", performance.now() - t);

            const { result } = response;
            if (result.error) {
                logger.error(`Spell check error: ${result.error}`);
            } else if (result.misspelledCount > 0) {
                logger.warn(
                    `Found ${result.misspelledCount} misspelled words:`
                );
                for (const word of result.misspelled) {
                    logger.warn(`\t- "${word}"`);
                }
            } else {
                logger.info("No spelling errors found");
            }

            resolve();
        });

        worker.once("error", (error) => {
            worker.terminate();
            logger.error(`Spell check error: ${getErrorMessage(error)}`);
            resolve();
        });
    });
}
