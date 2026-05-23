import type { Variant } from "./types.js";

export function normalizeVariants(
    raw: (string | Variant)[] | undefined
): Variant[] {
    if (!raw || raw.length === 0) return [];
    return raw.map((entry, i) => {
        if (typeof entry === "string") {
            if (entry.length === 0) {
                throw new Error(`Variant at index ${i} is an empty string`);
            }
            return { name: entry, language: entry };
        }
        if (
            entry === null ||
            typeof entry !== "object" ||
            typeof entry.name !== "string" ||
            entry.name.length === 0
        ) {
            throw new Error(
                `Variant at index ${i} must have a non-empty 'name'`
            );
        }
        return entry.language
            ? { name: entry.name, language: entry.language }
            : { name: entry.name };
    });
}
