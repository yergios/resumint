export function resolveVariants<T>(
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
