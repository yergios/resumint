import { ICON_SVGS } from "./icons.js";
import { resolveVariants } from "./variants.js";
import { renderTemplate } from "./template.js";
import { dirname } from "node:path";
import type { ResumeMetadata } from "./types.js";

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
    templatePath: string,
    template: string,
    data: ResumeMetadata & Record<string, unknown>,
    activeVariant: string
): string {
    const variantNames = (data.variants ?? []).map((v) =>
        typeof v === "string" ? v : v.name
    );
    const resolved = resolveVariants(
        data,
        variantNames,
        activeVariant
    ) as Record<string, unknown>;

    attachIcons(resolved);

    const html = renderTemplate(template, { ...resolved, activeVariant });

    const templatesAbsPath = dirname(templatePath);
    const baseTag = `<base href="file://${templatesAbsPath}/">`;

    return html.replace("<head>", `<head>\n    ${baseTag}`);
}
