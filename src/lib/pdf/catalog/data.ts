import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import {
    buildCanonicalProductGroup,
    buildCanonicalProductVariant,
    type CanonicalProductGroupInput,
    type CanonicalProductVariantInput,
} from "../../canonicalProduct";
import { resolvePageConfig } from "./config";
import { countFacet, filterCatalogGroups, filterProducts } from "./filters";
import type {
    CatalogPdfData,
    CatalogPdfOptions,
    PrintableCatalogGroup,
    PrintableProduct,
} from "./types";

type RawCatalogGroup = CanonicalProductGroupInput & Record<string, unknown>;
type RawProduct = CanonicalProductVariantInput & Record<string, unknown>;

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
    const canonical = buildCanonicalProductGroup(raw, [], "pdf");
    return {
        id: canonical.id,
        slug: canonical.slug,
        displayName: canonical.displayName,
        family: canonical.family,
        capacity: canonical.capacity,
        capacityMl: canonical.capacityMl,
        color: canonical.canonicalColor,
        rawColor: canonical.rawColor,
        canonicalColor: canonical.canonicalColor,
        canonicalColorOptions: canonical.canonicalColorOptions,
        category: canonical.category,
        collection: canonical.collection,
        brand,
        neckThreadSize: canonical.neckThreadSize,
        variantCount: canonical.variantCount,
        priceRangeMin: canonical.priceRangeMin,
        priceRangeMax: canonical.priceRangeMax,
        heroImageUrl: optimizeImageUrl(canonical.heroImageUrl, options.imageQuality),
        applicatorTypes: canonical.applicatorTypes.length ? canonical.applicatorTypes : asStringArray(raw.applicatorTypes),
        description: canonical.description,
        primaryGraceSku: canonical.primaryGraceSku,
        primaryWebsiteSku: canonical.primaryWebsiteSku,
        dataQualityFlags: canonical.dataQualityFlags,
    };
}

function normalizeProduct(raw: RawProduct, options: CatalogPdfOptions): PrintableProduct {
    const canonical = buildCanonicalProductVariant(raw, null, "pdf");
    return {
        id: canonical.id,
        graceSku: canonical.graceSku,
        websiteSku: canonical.websiteSku,
        itemName: canonical.itemName,
        family: canonical.family,
        capacity: canonical.capacity,
        capacityMl: canonical.capacityMl,
        color: canonical.canonicalColor,
        rawColor: canonical.rawColor,
        canonicalColor: canonical.canonicalColor,
        shape: canonical.shape,
        category: canonical.category,
        collection: canonical.collection,
        brand: asString(raw.brand) ?? "Best Bottles",
        applicator: canonical.applicator,
        neckThreadSize: canonical.neckThreadSize,
        heightWithCap: canonical.heightWithCap,
        heightWithoutCap: canonical.heightWithoutCap,
        diameter: canonical.diameter,
        bottleWeightG: canonical.bottleWeightG,
        caseQuantity: canonical.caseQuantity,
        price1pc: canonical.webPrice1pc,
        price12pc: canonical.webPrice12pc,
        stockStatus: canonical.stockStatus,
        description: canonical.description,
        imageUrl: optimizeImageUrl(canonical.imageUrl, options.imageQuality),
        productUrl: canonical.productUrl,
        dataQualityFlags: canonical.dataQualityFlags,
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
