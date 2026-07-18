import { dirname } from "node:path";
import { ICON_SVGS } from "./icons.js";
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
    templatePath: string,
    template: string,
    data: Record<string, unknown>,
    activeVariant: string
): string {
    attachIcons(data);

    const html = renderTemplate(template, { ...data, activeVariant });

    const templatesAbsPath = dirname(templatePath);
    const baseTag = `<base href="file://${templatesAbsPath}/">`;

    return html.replace("<head>", `<head>\n    ${baseTag}`);
}
