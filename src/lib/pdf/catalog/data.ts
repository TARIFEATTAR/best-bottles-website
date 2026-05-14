import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { resolvePageConfig } from "./config";
import { countFacet, filterCatalogGroups, filterProducts } from "./filters";
import type {
    CatalogPdfData,
    CatalogPdfOptions,
    PrintableCatalogGroup,
    PrintableProduct,
} from "./types";

type RawCatalogGroup = Record<string, unknown>;
type RawProduct = Record<string, unknown>;

let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
    if (!url) {
        throw new Error("NEXT_PUBLIC_CONVEX_URL or CONVEX_URL is required to generate catalog PDFs.");
    }
    convexClient ??= new ConvexHttpClient(url);
    return convexClient;
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
}

function optimizeImageUrl(url: string | null, quality: CatalogPdfOptions["imageQuality"]): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname === "cdn.sanity.io") {
            parsed.searchParams.set("fit", "max");
            parsed.searchParams.set("auto", "format");
            parsed.searchParams.set("q", quality === "print" ? "95" : "82");
            parsed.searchParams.set("w", quality === "print" ? "2200" : "1200");
        }
        return parsed.toString();
    } catch {
        return url;
    }
}

function normalizeGroup(raw: RawCatalogGroup, options: CatalogPdfOptions): PrintableCatalogGroup {
    const brand = asString(raw.brand) ?? "Best Bottles";
    return {
        id: String(raw._id ?? raw.id ?? ""),
        slug: asString(raw.slug) ?? "",
        displayName: asString(raw.displayName) ?? "Untitled Product",
        family: asString(raw.family),
        capacity: asString(raw.capacity),
        capacityMl: asNumber(raw.capacityMl),
        color: asString(raw.color),
        category: asString(raw.category) ?? "Other",
        collection: asString(raw.bottleCollection),
        brand,
        neckThreadSize: asString(raw.neckThreadSize),
        variantCount: asNumber(raw.variantCount) ?? 1,
        priceRangeMin: asNumber(raw.priceRangeMin),
        priceRangeMax: asNumber(raw.priceRangeMax),
        heroImageUrl: optimizeImageUrl(asString(raw.heroImageUrl), options.imageQuality),
        applicatorTypes: asStringArray(raw.applicatorTypes),
        description: asString(raw.groupDescription),
        primaryGraceSku: asString(raw.primaryGraceSku),
        primaryWebsiteSku: asString(raw.primaryWebsiteSku),
    };
}

function normalizeProduct(raw: RawProduct, options: CatalogPdfOptions): PrintableProduct {
    return {
        id: String(raw._id ?? raw.id ?? ""),
        graceSku: asString(raw.graceSku) ?? "",
        websiteSku: asString(raw.websiteSku) ?? "",
        itemName: asString(raw.itemName) ?? "Untitled SKU",
        family: asString(raw.family),
        capacity: asString(raw.capacity),
        capacityMl: asNumber(raw.capacityMl),
        color: asString(raw.color),
        shape: asString(raw.shape),
        category: asString(raw.category) ?? "Other",
        collection: asString(raw.bottleCollection),
        brand: asString(raw.brand) ?? "Best Bottles",
        applicator: asString(raw.applicator),
        neckThreadSize: asString(raw.neckThreadSize),
        heightWithCap: asString(raw.heightWithCap),
        heightWithoutCap: asString(raw.heightWithoutCap),
        diameter: asString(raw.diameter),
        bottleWeightG: asNumber(raw.bottleWeightG),
        caseQuantity: asNumber(raw.caseQuantity),
        price1pc: asNumber(raw.webPrice1pc),
        price12pc: asNumber(raw.webPrice12pc),
        stockStatus: asString(raw.stockStatus),
        description: asString(raw.itemDescription) ?? asString(raw.graceDescription),
        imageUrl: optimizeImageUrl(asString(raw.imageUrl), options.imageQuality),
        productUrl: asString(raw.productUrl),
    };
}

async function fetchProductExport(options: CatalogPdfOptions): Promise<PrintableProduct[]> {
    const client = getConvexClient();
    const products: PrintableProduct[] = [];
    let cursor: string | null = null;

    while (products.length < options.limit) {
        const result = await client.action(api.products.getProductExportPage, {
            cursor,
            numItems: Math.min(options.chunkSize, options.limit - products.length),
        }) as {
            page: RawProduct[];
            isDone: boolean;
            continueCursor: string;
        };

        products.push(...result.page.map((item) => normalizeProduct(item, options)));
        if (result.isDone) break;
        cursor = result.continueCursor;
    }

    return filterProducts(products, options);
}

export async function fetchCatalogPdfData(options: CatalogPdfOptions): Promise<CatalogPdfData> {
    const client = getConvexClient();
    const page = resolvePageConfig(options.pagePreset, options.orientation, options.mode);
    const rawGroups = await client.query(api.products.getAllCatalogGroups, {}) as RawCatalogGroup[];
    const allGroups = rawGroups.map((item) => normalizeGroup(item, options));
    const groups = filterCatalogGroups(allGroups, options);
    const products = options.mode === "lookbook" && !options.includeSpecs
        ? []
        : await fetchProductExport(options);
    const facetSource = groups.length ? groups : allGroups;
    const heroImageUrl = groups.find((group) => group.heroImageUrl)?.heroImageUrl ?? null;

    return {
        options,
        page,
        groups,
        products,
        generatedAt: new Date().toISOString(),
        heroImageUrl,
        facets: {
            totalGroups: groups.length,
            totalProducts: products.length || groups.reduce((sum, group) => sum + group.variantCount, 0),
            families: countFacet(facetSource, (group) => group.family).slice(0, 24),
            collections: countFacet(facetSource, (group) => group.collection).slice(0, 24),
            categories: countFacet(facetSource, (group) => group.category).slice(0, 16),
        },
    };
}
