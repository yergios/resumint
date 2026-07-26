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

// `baseHref` sets the document's <base>: the PDF path passes a file:// URL so
// Chrome can load the template's local assets, while the preview server passes
// "/" so those same assets resolve against the HTTP static handler.
export function renderHtml(
    template: string,
    data: Record<string, unknown>,
    activeVariant: string,
    baseHref: string
): string {
    attachIcons(data);

    const html = renderTemplate(template, { ...data, activeVariant });

    const baseTag = `<base href="${baseHref}">`;

    return html.replace("<head>", `<head>\n    ${baseTag}`);
}
