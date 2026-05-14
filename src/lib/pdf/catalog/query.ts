import {
    DEFAULT_CATALOG_LIMIT,
    DEFAULT_EXPORT_CHUNK_SIZE,
    MAX_CATALOG_LIMIT,
    isCatalogPagePreset,
} from "./config";
import type {
    CatalogImageQuality,
    CatalogOrientation,
    CatalogPdfMode,
    CatalogPdfOptions,
} from "./types";

const VALID_MODES = new Set<CatalogPdfMode>(["lookbook", "line-sheet", "spec-book"]);
const VALID_ORIENTATIONS = new Set<CatalogOrientation>(["portrait", "landscape"]);
const VALID_IMAGE_QUALITY = new Set<CatalogImageQuality>(["preview", "print"]);

function multiParam(params: URLSearchParams, keys: string[]): string[] {
    return keys
        .flatMap((key) => params.getAll(key))
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);
}

function booleanParam(params: URLSearchParams, key: string, fallback: boolean): boolean {
    const value = params.get(key);
    if (value == null) return fallback;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function boundedNumber(
    value: string | null,
    fallback: number,
    min: number,
    max: number,
): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(Math.floor(parsed), max));
}

function safeFilename(raw: string): string {
    return raw
        .trim()
        .replace(/\.pdf$/i, "")
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90) || "best-bottles-catalog";
}

export function parseCatalogPdfOptions(params: URLSearchParams): CatalogPdfOptions {
    const modeParam = params.get("mode") ?? "lookbook";
    const mode = VALID_MODES.has(modeParam as CatalogPdfMode)
        ? (modeParam as CatalogPdfMode)
        : "lookbook";

    const pageParam = params.get("pageSize") ?? params.get("format") ?? "letter";
    const pagePreset = isCatalogPagePreset(pageParam) ? pageParam : "letter";

    const orientationParam = params.get("orientation") ?? "portrait";
    const orientation = VALID_ORIENTATIONS.has(orientationParam as CatalogOrientation)
        ? (orientationParam as CatalogOrientation)
        : "portrait";

    const imageQualityParam = params.get("imageQuality") ?? "print";
    const imageQuality = VALID_IMAGE_QUALITY.has(imageQualityParam as CatalogImageQuality)
        ? (imageQualityParam as CatalogImageQuality)
        : "print";

    const title = params.get("title")?.trim() || "Best Bottles Catalog";
    const subtitle = params.get("subtitle")?.trim() || "Wholesale fragrance and beauty packaging";
    const filename = safeFilename(params.get("filename") || title);

    return {
        mode,
        pagePreset,
        orientation,
        title,
        subtitle,
        category: multiParam(params, ["category", "categories"]),
        collection: multiParam(params, ["collection", "collections"]),
        family: multiParam(params, ["family", "families"]),
        brand: multiParam(params, ["brand", "brands"]),
        applicators: multiParam(params, ["applicator", "applicators"]),
        search: params.get("search")?.trim() || "",
        limit: boundedNumber(params.get("limit"), DEFAULT_CATALOG_LIMIT, 1, MAX_CATALOG_LIMIT),
        chunkSize: boundedNumber(params.get("chunkSize"), DEFAULT_EXPORT_CHUNK_SIZE, 50, 400),
        includePricing: booleanParam(params, "pricing", true),
        includeIndex: booleanParam(params, "index", true),
        includeSpecs: booleanParam(params, "specs", mode !== "lookbook"),
        imageQuality,
        debugHtml: booleanParam(params, "debug", false) || params.get("format") === "html",
        inline: booleanParam(params, "inline", false),
        filename,
    };
}
