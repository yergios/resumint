import { ICON_SVGS } from "./icons.js";
import { resolveVariants } from "./resolve-variants.js";
import { renderTemplate } from "./template.js";

function attachIcons(data: Record<string, unknown>): void {
    const basic = data["basic"] as Record<string, unknown> | undefined;
    const contactInfo = basic?.["contactInfo"];
    if (!Array.isArray(contactInfo)) return;
    for (const item of contactInfo) {
        if (item && typeof item === "object") {
            const entry = item as Record<string, unknown>;
            const type = entry["type"];
            if (typeof type === "string") {
                entry["iconSvg"] = ICON_SVGS[type] ?? "";
            }
        }
    }
}

export function renderHtml(
    source: string,
    data: Record<string, unknown>,
    variant: string,
    variantNames: string[],
    templatesAbsPath: string
): string {
    const resolved = resolveVariants(data, variantNames, variant) as Record<
        string,
        unknown
    >;
    attachIcons(resolved);
    const html = renderTemplate(source, { ...resolved, variant });
    const baseTag = `<base href="file://${templatesAbsPath}/">`;
    return html.replace("<head>", `<head>\n    ${baseTag}`);
}
