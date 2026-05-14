import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { resolveSearchCatalogParameters } from "@/lib/graceToolParamUtils";
import {
    buildSearchCatalogToolResult,
    emptySearchCatalogHint,
} from "../../../../../convex/graceSearchUtils";

/**
 * Server tools proxy for ElevenLabs Conversational AI.
 *
 * ElevenLabs server tools send a POST with { tool_name, parameters }.
 * This route executes the corresponding Convex query and returns the result.
 */

let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
    if (!_convex) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
        _convex = new ConvexHttpClient(url);
    }
    return _convex;
}

function getResultCount(result: unknown): number | null {
    if (Array.isArray(result)) return result.length;
    if (result && typeof result === "object") {
        const record = result as Record<string, unknown>;
        for (const key of ["totalVariants", "totalGroups", "totalComponents"]) {
            const value = record[key];
            if (typeof value === "number") return value;
        }
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        // All 12 agent tools are registered on ElevenLabs as type:"client",
        // which means the browser (our own page) fetches this endpoint — not
        // ElevenLabs' servers. Legit callers are always same-origin. External
        // callers still need the secret if set.
        const expectedSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
        if (expectedSecret) {
            const originHeader = req.headers.get("origin");
            const hostHeader = req.headers.get("host");
            let isSameOrigin = false;
            if (originHeader && hostHeader) {
                try {
                    isSameOrigin = new URL(originHeader).host === hostHeader;
                } catch { /* malformed origin */ }
            }
            if (!isSameOrigin) {
                const provided = req.headers.get("x-webhook-secret");
                if (provided !== expectedSecret) {
                    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
                }
            }
        }

        const body = (await req.json()) as {
            tool_name?: string;
            parameters?: Record<string, unknown>;
        };

        const { tool_name, parameters = {} } = body;

        if (!tool_name) {
            return NextResponse.json(
                { error: "Missing tool_name" },
                { status: 400 }
            );
        }

        const convex = getConvex();
        const t0 = Date.now();
        let result: unknown;

        switch (tool_name) {
            case "searchCatalog": {
                const searchParams = resolveSearchCatalogParameters(parameters);
                const data = await convex.query(
                    api.grace.searchCatalog,
                    searchParams
                );
                if (!Array.isArray(data)) {
                    result = data;
                } else if (data.length === 0) {
                    result = `No products found for that search. Try a broader term.${emptySearchCatalogHint(searchParams.searchTerm)}`;
                } else {
                    const slim = data.map((p) => ({
                        graceSku: p.graceSku,
                        itemName: p.itemName,
                        family: p.family,
                        capacity: p.capacity,
                        capacityMl: p.capacityMl,
                        color: p.color,
                        rawColor: p.rawColor,
                        canonicalColor: p.canonicalColor,
                        applicator: p.applicator,
                        capColor: p.capColor,
                        neckThreadSize: p.neckThreadSize,
                        slug: p.slug,
                        webPrice1pc: p.webPrice1pc,
                        stockStatus: p.stockStatus,
                        dataQualityFlags: p.dataQualityFlags,
                        sourceTrace: p.sourceTrace,
                    }));
                    result = buildSearchCatalogToolResult(searchParams, slim);
                }
                break;
            }

            case "getFamilyOverview": {
                result = await convex.query(api.grace.getFamilyOverview, {
                    family: (parameters.family as string) ?? "",
                });
                break;
            }

            case "getBottleComponents": {
                const data = await convex.query(api.grace.getBottleComponents, {
                    bottleSku: (parameters.bottleSku as string) ?? "",
                });
                if (data && typeof data === "object" && "bottle" in data) {
                    const d = data as {
                        bottle: Record<string, unknown>;
                        componentTypes: string[];
                        totalComponents: number;
                        components: Record<string, unknown>;
                    };
                    result = {
                        bottle: {
                            graceSku: d.bottle.graceSku,
                            itemName: d.bottle.itemName,
                            family: d.bottle.family,
                            capacity: d.bottle.capacity,
                            color: d.bottle.color,
                            neckThreadSize: d.bottle.neckThreadSize,
                            capStyle: d.bottle.capStyle,
                            webPrice1pc: d.bottle.webPrice1pc,
                        },
                        componentTypes: d.componentTypes,
                        totalComponents: d.totalComponents,
                        components: d.components,
                    };
                } else {
                    result = data;
                }
                break;
            }

            case "checkCompatibility": {
                result = await convex.query(api.grace.checkCompatibility, {
                    threadSize: (parameters.threadSize as string) ?? "",
                });
                break;
            }

            case "getCatalogStats": {
                result = await convex.query(api.grace.getCatalogStats, {});
                break;
            }

            case "getProductGroup": {
                result = await convex.query(api.products.getProductGroup, {
                    slug: (parameters.slug as string) ?? "",
                });
                break;
            }

            case "getProductBySku": {
                // Used by the new `displayProductCard` clientTool. Returns the
                // slim ProductCard shape the inline card components consume.
                const sku = (parameters.graceSku as string)
                    ?? (parameters.websiteSku as string)
                    ?? (parameters.sku as string)
                    ?? "";
                if (!sku) {
                    result = null;
                    break;
                }
                const data = await convex.query(api.products.getBySku, { graceSku: sku });
                if (!data) {
                    result = null;
                } else {
                    result = {
                        graceSku: data.graceSku,
                        itemName: data.itemName,
                        family: data.family,
                        capacity: data.capacity,
                        capacityMl: data.capacityMl,
                        color: data.color,
                        applicator: data.applicator,
                        capColor: data.capColor,
                        neckThreadSize: data.neckThreadSize,
                        webPrice1pc: data.webPrice1pc,
                        webPrice12pc: data.webPrice12pc,
                        // Hero image from product group (catalog renders this);
                        // fall back to per-product imageUrl when group hero missing.
                        heroImageUrl: data.imageUrl ?? null,
                    };
                }
                break;
            }

            case "getFamilyForCard": {
                // Pattern B — full family payload: variants + thread sizes + tagline.
                // Primary path uses cached `primaryGraceSku` on each group; when
                // the backfill hasn't populated those, falls back to searchCatalog
                // (which returns real variants with graceSku + slug).
                const family = (parameters.family as string) ?? "";
                if (!family) { result = null; break; }
                const groups = await convex.query(api.products.getProductGroupsByFamily, { family });
                const overview = await convex.query(api.grace.getFamilyOverview, { family });
                let variants = (groups ?? [])
                    .filter((g) => g.primaryGraceSku)
                    .map((g) => ({
                        graceSku: g.primaryGraceSku as string,
                        itemName: g.displayName,
                        family: g.family,
                        capacity: g.capacity,
                        capacityMl: g.capacityMl,
                        color: g.color,
                        neckThreadSize: g.neckThreadSize,
                        webPrice1pc: g.priceRangeMin,
                        slug: g.slug,
                        heroImageUrl: g.heroImageUrl ?? null,
                    }));

                // Fallback: groups missing primaryGraceSku — search the catalog
                // and dedupe by capacityMl so we still get one variant per size.
                if (variants.length === 0) {
                    const search = await convex.query(api.grace.searchCatalog, {
                        searchTerm: family,
                        familyLimit: family,
                    });
                    const seen = new Set<string | number>();
                    variants = (Array.isArray(search) ? search : [])
                        .filter((p) => {
                            const key = p.capacityMl ?? p.capacity ?? p.graceSku;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        })
                        .slice(0, 8)
                        .map((p) => ({
                            graceSku: p.graceSku,
                            itemName: p.itemName,
                            // Fallback path: searchCatalog returns family/slug as
                            // optional, but the primary `groups`-based path infers
                            // them as required strings. Coerce to satisfy the
                            // inferred shape — we know the queried `family` is
                            // valid because we just used it as the search key.
                            family: p.family ?? family,
                            capacity: p.capacity,
                            capacityMl: p.capacityMl,
                            color: p.color,
                            neckThreadSize: p.neckThreadSize,
                            webPrice1pc: p.webPrice1pc,
                            slug: p.slug ?? "",
                            heroImageUrl: null as string | null,
                        }));
                }

                result = {
                    family,
                    tagline: overview && typeof overview === "object" && "graceHint" in overview
                        ? String((overview as { graceHint?: string }).graceHint ?? "")
                        : "",
                    variants,
                    defaultGraceSku: variants[0]?.graceSku,
                    threadSizes: overview && typeof overview === "object" && "threadSizes" in overview
                        ? ((overview as { threadSizes?: string[] }).threadSizes ?? [])
                        : [],
                    priceFromCents: variants.length
                        ? Math.round((Math.min(...variants.map((v) => v.webPrice1pc ?? Infinity).filter((n) => Number.isFinite(n))) || 0) * 100)
                        : null,
                };
                break;
            }

            case "getCatalogStrip": {
                // Pattern L — every family group with hero image, capped at 60.
                const groups = await convex.query(api.products.getAllCatalogGroups, {});
                const seenFamilies = new Set<string>();
                const families: Array<{ family: string; heroImageUrl: string | null; variantCount: number }> = [];
                for (const g of (groups ?? [])) {
                    if (!g.family || seenFamilies.has(g.family)) continue;
                    seenFamilies.add(g.family);
                    families.push({
                        family: g.family,
                        heroImageUrl: g.heroImageUrl ?? null,
                        variantCount: g.variantCount ?? 0,
                    });
                    if (families.length >= 60) break;
                }
                result = {
                    families,
                    activeCategory: parameters.category ?? null,
                    categories: ["Roller balls", "Atomizers", "Droppers", "Sprayers", "Apothecary", "Decorative"],
                };
                break;
            }

            case "getProductsForComparison": {
                // Pattern F — fetch N SKUs in parallel for the comparison table.
                const skus = (parameters.graceSkus as string[]) ?? [];
                const fetched = await Promise.all(
                    skus.map((sku) =>
                        convex.query(api.products.getBySku, { graceSku: sku }).catch(() => null),
                    ),
                );
                result = fetched
                    .filter((p): p is NonNullable<typeof p> => !!p)
                    .map((p) => ({
                        graceSku: p.graceSku,
                        itemName: p.itemName,
                        family: p.family,
                        capacity: p.capacity,
                        capacityMl: p.capacityMl,
                        color: p.color,
                        applicator: p.applicator,
                        neckThreadSize: p.neckThreadSize,
                        webPrice1pc: p.webPrice1pc,
                        webPrice12pc: p.webPrice12pc,
                        heroImageUrl: p.imageUrl ?? null,
                        heightMm: null,
                    }));
                break;
            }

            default:
                return NextResponse.json(
                    { error: `Unknown tool: ${tool_name}` },
                    { status: 400 }
                );
        }

        console.info("[EL server-tool] ok", {
            tool_name,
            durationMs: Date.now() - t0,
            resultCount: getResultCount(result),
            resultType: Array.isArray(result) ? "array" : typeof result,
        });

        return NextResponse.json({ result });
    } catch (err) {
        console.error("[EL server-tool] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
