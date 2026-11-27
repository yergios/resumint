// A run of text pulled from the PDF, in PDF user-space units (origin at the
// bottom-left of the page, so a larger y is higher on the page).
export interface TextItem {
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
    hasEOL: boolean;
}

// One page's items, in the order they appear in the PDF content stream.
export type PageItems = TextItem[];

// A visual line rebuilt from positions: items on the same baseline, left to
// right. This is what position-based extractors (and most ATS parsers) see.
export type LayoutLine = TextItem[];

export type FindingKind = "missing" | "merged" | "order" | "garbled" | "date";

export interface Finding {
    kind: FindingKind;
    message: string;
}
