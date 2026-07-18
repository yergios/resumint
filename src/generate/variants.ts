import type { ResumeMetadata, Variant } from "./types.js";

export function getVariantsToRun(
    raw?: (string | Variant)[],
    chosenVariant?: string
): Variant[] {
    if (!raw || raw.length === 0) {
        throw new Error("No variants declared in resume data");
    }

    const allVariants = raw.map((entry, i) => {
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

    let variantsToRun: Variant[] = [];

    if (chosenVariant) {
        const match = allVariants.find((v) => v.name === chosenVariant);
        if (!match) {
            const names = allVariants.map((v) => v.name).join(", ");
            throw new Error(
                `Unknown variant: '${chosenVariant}'. Valid variants: ${names}`
            );
        }
        variantsToRun = [match];
    } else {
        variantsToRun = allVariants;
    }

    return variantsToRun;
}

// Resolve the variant-keyed source data into a standalone copy per variant,
// once, up front — so rendering just consumes a plain, already-resolved object
// instead of re-walking the tree for every variant at render time.
export function resolveVariantData(
    data: ResumeMetadata & Record<string, unknown>,
    variantsToRun: Variant[]
): { variant: Variant; data: Record<string, unknown> }[] {
    const variantNames = (data.variants ?? []).map((v) =>
        typeof v === "string" ? v : v.name
    );

    return variantsToRun.map((variant) => ({
        variant,
        data: resolveVariants(data, variantNames, variant.name) as Record<
            string,
            unknown
        >
    }));
}

function resolveVariants<T>(
    data: T,
    variantNames: string[],
    active: string
): T {
    return walk(data) as T;

    function walk(node: unknown): unknown {
        if (Array.isArray(node)) return node.map(walk);
        if (node === null || typeof node !== "object") return node;

        const obj = node as Record<string, unknown>;
        const keys = Object.keys(obj);

        if (keys.length > 0 && keys.every((k) => variantNames.includes(k))) {
            return walk(obj[active]);
        }

        return Object.fromEntries(keys.map((k) => [k, walk(obj[k])]));
    }
}
