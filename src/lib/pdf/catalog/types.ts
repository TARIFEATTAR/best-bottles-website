export type CatalogPdfMode = "lookbook" | "line-sheet" | "spec-book";

export type CatalogOrientation = "portrait" | "landscape";

export type CatalogPagePreset =
    | "letter"
    | "a4"
    | "square"
    | "presentation"
    | "luxury";

export type CatalogImageQuality = "preview" | "print";

export interface CatalogPageConfig {
    preset: CatalogPagePreset;
    label: string;
    width: string;
    height: string;
    orientation: CatalogOrientation;
    safeMargin: string;
    bleed: string;
    gridColumns: number;
    gridRows: number;
    specRowsPerPage: number;
}

export interface CatalogPdfOptions {
    mode: CatalogPdfMode;
    pagePreset: CatalogPagePreset;
    orientation: CatalogOrientation;
    title: string;
    subtitle: string;
    category: string[];
    collection: string[];
    family: string[];
    brand: string[];
    applicators: string[];
    search: string;
    limit: number;
    chunkSize: number;
    includePricing: boolean;
    includeIndex: boolean;
    includeSpecs: boolean;
    imageQuality: CatalogImageQuality;
    debugHtml: boolean;
    inline: boolean;
    filename: string;
}

export interface PrintableCatalogGroup {
    id: string;
    slug: string;
    displayName: string;
    family: string | null;
    capacity: string | null;
    capacityMl: number | null;
    color: string | null;
    rawColor: string | null;
    canonicalColor: string | null;
    canonicalColorOptions: string[];
    category: string;
    collection: string | null;
    brand: string | null;
    neckThreadSize: string | null;
    variantCount: number;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    heroImageUrl: string | null;
    applicatorTypes: string[];
    description: string | null;
    primaryGraceSku: string | null;
    primaryWebsiteSku: string | null;
    dataQualityFlags: string[];
}

export interface PrintableProduct {
    id: string;
    graceSku: string;
    websiteSku: string;
    itemName: string;
    family: string | null;
    capacity: string | null;
    capacityMl: number | null;
    color: string | null;
    rawColor: string | null;
    canonicalColor: string | null;
    shape: string | null;
    category: string;
    collection: string | null;
    brand: string | null;
    applicator: string | null;
    neckThreadSize: string | null;
    heightWithCap: string | null;
    heightWithoutCap: string | null;
    diameter: string | null;
    bottleWeightG: number | null;
    caseQuantity: number | null;
    price1pc: number | null;
    price12pc: number | null;
    stockStatus: string | null;
    description: string | null;
    imageUrl: string | null;
    productUrl: string | null;
    dataQualityFlags: string[];
}

export interface CatalogFacetSummary {
    totalGroups: number;
    totalProducts: number;
    families: Array<{ label: string; count: number }>;
    collections: Array<{ label: string; count: number }>;
    categories: Array<{ label: string; count: number }>;
}

export interface CatalogPdfData {
    options: CatalogPdfOptions;
    page: CatalogPageConfig;
    groups: PrintableCatalogGroup[];
    products: PrintableProduct[];
    facets: CatalogFacetSummary;
    generatedAt: string;
    heroImageUrl: string | null;
}
