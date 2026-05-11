import Handlebars from "handlebars";
import { ICON_SVGS } from "./icons.js";

export function setupHandlebars(): void {
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

export function renderHtml(
    template: HandlebarsTemplateDelegate,
    data: Record<string, unknown>,
    language: string,
    templatesAbsPath: string
): string {
    const rawHtml = template({ ...data, language });
    const baseTag = `<base href="file://${templatesAbsPath}/">`;
    return rawHtml.replace("<head>", `<head>\n    ${baseTag}`);
}
