import type {
    CatalogOrientation,
    CatalogPageConfig,
    CatalogPagePreset,
    CatalogPdfMode,
} from "./types";

type PresetDefinition = Omit<CatalogPageConfig, "preset" | "orientation">;

const PAGE_PRESETS: Record<CatalogPagePreset, PresetDefinition> = {
    letter: {
        label: "US Letter",
        width: "8.5in",
        height: "11in",
        safeMargin: "0.48in",
        bleed: "0.12in",
        gridColumns: 3,
        gridRows: 3,
        specRowsPerPage: 18,
    },
    a4: {
        label: "A4",
        width: "210mm",
        height: "297mm",
        safeMargin: "12mm",
        bleed: "3mm",
        gridColumns: 3,
        gridRows: 3,
        specRowsPerPage: 19,
    },
    square: {
        label: "Square Presentation",
        width: "8in",
        height: "8in",
        safeMargin: "0.42in",
        bleed: "0.12in",
        gridColumns: 3,
        gridRows: 2,
        specRowsPerPage: 12,
    },
    presentation: {
        label: "Presentation",
        width: "10in",
        height: "7.5in",
        safeMargin: "0.44in",
        bleed: "0.12in",
        gridColumns: 4,
        gridRows: 2,
        specRowsPerPage: 12,
    },
    luxury: {
        label: "Luxury Catalog",
        width: "9in",
        height: "12in",
        safeMargin: "0.55in",
        bleed: "0.125in",
        gridColumns: 3,
        gridRows: 4,
        specRowsPerPage: 22,
    },
};

export const DEFAULT_CATALOG_LIMIT = 240;
export const MAX_CATALOG_LIMIT = 2500;
export const DEFAULT_EXPORT_CHUNK_SIZE = 180;

export const FAMILY_ORDER = [
    "Cylinder",
    "Elegant",
    "Circle",
    "Sleek",
    "Diva",
    "Empire",
    "Boston Round",
    "Slim",
    "Diamond",
    "Royal",
    "Round",
    "Square",
    "Rectangle",
    "Flair",
    "Tulip",
    "Queen",
    "Bell",
    "Swirl",
    "Grace",
];

export const CATEGORY_ORDER = [
    "Glass Bottle",
    "Cream Jar",
    "Lotion Bottle",
    "Plastic Bottle",
    "Metal Atomizer",
    "Component",
    "Cap/Closure",
    "Roll-On Cap",
    "Accessory",
    "Packaging Box",
    "Other",
];

export function resolvePageConfig(
    preset: CatalogPagePreset,
    orientation: CatalogOrientation,
    mode: CatalogPdfMode,
): CatalogPageConfig {
    const base = PAGE_PRESETS[preset] ?? PAGE_PRESETS.letter;
    const landscape = orientation === "landscape";
    const width = landscape ? base.height : base.width;
    const height = landscape ? base.width : base.height;

    return {
        ...base,
        preset,
        orientation,
        width,
        height,
        gridColumns: landscape ? Math.max(base.gridColumns + 1, 4) : base.gridColumns,
        gridRows: mode === "spec-book" ? Math.max(base.gridRows - 1, 2) : base.gridRows,
        specRowsPerPage: landscape
            ? Math.max(base.specRowsPerPage - 4, 10)
            : base.specRowsPerPage,
    };
}

export function isCatalogPagePreset(value: string): value is CatalogPagePreset {
    return value in PAGE_PRESETS;
}
