import { query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { normalizeComponentsByType } from "./componentUtils";

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT QUERIES — Powers the Homepage + Catalog + PDP
// ─────────────────────────────────────────────────────────────────────────────

// Retrieve all products (limited to 100 for basic demonstration/catalog landing)
export const listAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("products").take(100);
    },
});

// Get a specific product by its exact Grace Sku
export const getBySku = query({
    args: { graceSku: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", args.graceSku))
            .first();
    },
});

// Find products by their family (e.g. "Boston Round")
export const getByFamily = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .take(100); // Using take to prevent massive waterfall queries
    },
});

// Find products by their exact category (e.g. "Bottle" or "Component")
export const getByCategory = query({
    args: { category: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_category", (q) => q.eq("category", args.category))
            .take(100);
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// HOMEPAGE QUERIES — Live stats for Design Families + Trust Bar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns aggregate stats for the homepage:
 * - Total product count
 * - Per-collection (bottleCollection) counts
 * - Per-family counts
 * - Per-category counts
 * - In-stock count
 */
export const getHomepageStats = query({
    args: {},
    handler: async (ctx) => {
        // Use productGroups (~146 small docs) instead of products (~2285 large docs
        // with huge components arrays) to avoid the 16MB per-execution read limit.
        const groups = await ctx.db.query("productGroups").collect();

        // Total individual SKU variants = sum of each group's variantCount
        let totalProducts = 0;
        const collectionCounts: Record<string, number> = {};
        const familyCounts: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};

        for (const g of groups) {
            const n = g.variantCount ?? 1;
            totalProducts += n;

            if (g.bottleCollection) {
                collectionCounts[g.bottleCollection] = (collectionCounts[g.bottleCollection] || 0) + n;
            }
            if (g.family) {
                familyCounts[g.family] = (familyCounts[g.family] || 0) + n;
            }
            categoryCounts[g.category] = (categoryCounts[g.category] || 0) + n;
        }

        return {
            totalProducts,
            inStockCount: totalProducts, // all seeded products are in stock; update when live stock sync lands
            collectionCounts,
            familyCounts,
            categoryCounts,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// FITMENT MATCHMAKING ALGORITHM — Powers the 'Engineered Compatibility' UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a bottle SKU, this algorithm instantly finds all mathematically compatible
 * closures, sprayers, and droppers.
 *
 * Returns components as a type-grouped map for FitmentDrawer / FitmentCarousel:
 *   { "Sprayer": [...], "Dropper": [...], "Roll-On Cap": [...], "Lotion Pump": [...], "Cap": [...] }
 */
export const getCompatibleFitments = query({
    args: { bottleSku: v.string() },
    handler: async (ctx, args) => {
        // 1. Get the target bottle
        const bottle = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", args.bottleSku))
            .first() || await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.bottleSku))
                .first();

        if (!bottle) return { bottle: null, components: null };

        const bottleThread = (bottle.neckThreadSize ?? "").toString().trim();
        const grouped = normalizeComponentsByType(bottle.components);
        const isPlasticBottlePdp = (bottle.category ?? "") === "Plastic Bottle";

        // 2. Filter components by thread — 18-400 caps don't fit 17-415 bottles, etc.
        // Extract thread from SKU (e.g. CMP-CAP-BLK-18-400 → "18-400") and exclude mismatches
        const threadFromSku = (sku: string): string | null => {
            const m = sku.match(/(\d{2}-\d{3})/);
            return m ? m[1] : null;
        };
        const isPlasticBottleComponent = (itemName: string): boolean =>
            /plastic bottle with/i.test(itemName);
        const filteredEntries = Object.entries(grouped).map(([type, items]) => {
            const matching = items.filter((item) => {
                // Guard: suppress cross-category plastic bottle products from glass-bottle fitment UI
                // (e.g. "Plastic Bottle with Silver Spray Top ...") unless we're on a plastic bottle PDP.
                if (!isPlasticBottlePdp && isPlasticBottleComponent(item.itemName)) return false;
                const compThread = threadFromSku(item.graceSku);
                return !compThread || compThread === bottleThread;
            });
            return [type, matching] as const;
        });

        return {
            bottle,
            components: Object.fromEntries(
                filteredEntries.map(([type, items]) => [
                    type,
                    items.map((item) => ({
                        graceSku: item.graceSku,
                        itemName: item.itemName,
                        imageUrl: item.imageUrl,
                        price1: item.webPrice1pc,
                        price12: item.webPrice12pc,
                    })),
                ]),
            ),
        };
    },
});


/**
 * Featured products for the homepage — pulls 1 representative product
 * from each of the primary design families (Glass Bottles only).
 */
export const getFeaturedByFamily = query({
    args: {},
    handler: async (ctx) => {
        const targetFamilies = [
            "Cylinder", "Elegant", "Circle", "Diva",
            "Empire", "Slim", "Boston Round", "Sleek",
            "Diamond", "Royal", "Round", "Square",
        ];

        const featured: Record<string, unknown> = {};
        for (const family of targetFamilies) {
            const product = await ctx.db
                .query("products")
                .withIndex("by_family", (q) => q.eq("family", family))
                .first();
            if (product) {
                featured[family] = product;
            }
        }

        return featured;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG QUERIES — Powers the Master Catalog page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get products grouped by bottleCollection — returns up to `limit` per
 * collection, sorted for the catalog page.
 */
export const getByCollection = query({
    args: { collection: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        // Use productGroups index to avoid reading all products
        return await ctx.db
            .query("productGroups")
            .withIndex("by_collection", (q) => q.eq("bottleCollection", args.collection))
            .take(args.limit ?? 50);
    },
});

/**
 * Returns the full catalog taxonomy for the sidebar:
 * Collections grouped by category, with counts.
 */
export const getCatalogTaxonomy = query({
    args: {},
    handler: async (ctx) => {
        // Use productGroups instead of products to stay under the 16MB read limit.
        // variantCount is used so sidebar totals reflect individual SKU counts.
        const groups = await ctx.db.query("productGroups").collect();

        const taxonomy: Record<string, Record<string, number>> = {};
        for (const g of groups) {
            const cat = g.category;
            const col = g.bottleCollection || "Uncategorized";
            const n = g.variantCount ?? 1;
            if (!taxonomy[cat]) taxonomy[cat] = {};
            taxonomy[cat][col] = (taxonomy[cat][col] || 0) + n;
        }

        return taxonomy;
    },
});

/**
 * Paginated product listing for catalog infinite scroll.
 * Returns products for a given collection, with cursor-based pagination.
 */
export const getCatalogProducts = query({
    args: {
        collection: v.optional(v.string()),
        category: v.optional(v.string()),
        family: v.optional(v.string()),
        searchTerm: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 50;

        // If search term, use search index
        if (args.searchTerm) {
            const q = ctx.db.query("products").withSearchIndex("search_itemName", (q) =>
                q.search("itemName", args.searchTerm!)
            );
            return await q.take(limit);
        }

        // Filter-based queries
        if (args.family) {
            return await ctx.db
                .query("products")
                .withIndex("by_family", (q) => q.eq("family", args.family!))
                .take(limit);
        }

        if (args.category) {
            return await ctx.db
                .query("products")
                .withIndex("by_category", (q) => q.eq("category", args.category!))
                .take(limit);
        }

        // Collection-based (no dedicated index yet) — read, then filter for correctness.
        if (args.collection) {
            const allProducts = await ctx.db.query("products").collect();
            return allProducts
                .filter((p) => p.bottleCollection === args.collection)
                .slice(0, limit);
        }

        // Default: return first batch
        return await ctx.db.query("products").take(limit);
    },
});

/**
 * Full-text search for the catalog search bar.
 */
export const searchProducts = query({
    args: {
        searchTerm: v.string(),
        category: v.optional(v.string()),
        family: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 30;
        const q = ctx.db.query("products").withSearchIndex("search_itemName", (q) => {
            let search = q.search("itemName", args.searchTerm);
            if (args.category) search = search.eq("category", args.category);
            if (args.family) search = search.eq("family", args.family);
            return search;
        });
        return await q.take(limit);
    },
});

export const checkCount = query({
    args: {},
    handler: async (ctx) => {
        // Sum variantCounts from productGroups (safe, no component blowup)
        const groups = await ctx.db.query("productGroups").collect();
        return groups.reduce((sum, g) => sum + (g.variantCount ?? 1), 0);
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT GROUP QUERIES — Phase 1: Powers grouped catalog + PDP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns every productGroup (~230 lightweight docs, <1KB each).
 * The catalog page filters, sorts, and paginates client-side.
 */
export const getAllCatalogGroups = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("productGroups").collect();
    },
});

/**
 * Returns one representative SKU per product group for line-item catalog view.
 * Preference: websiteSku first, then graceSku fallback.
 */
export const getCatalogGroupPrimarySkus = query({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();
        const rows = await Promise.all(
            groups.map(async (g) => {
                const firstVariant = await ctx.db
                    .query("products")
                    .withIndex("by_productGroupId", (q) => q.eq("productGroupId", g._id))
                    .first();
                return {
                    groupId: String(g._id),
                    websiteSku: firstVariant?.websiteSku ?? null,
                    graceSku: firstVariant?.graceSku ?? null,
                };
            })
        );
        return rows;
    },
});

/**
 * Paginated product group listing for the catalog page.
 * Mirrors getCatalogProducts but returns productGroups instead of flat SKUs.
 */
export const getCatalogGroups = query({
    args: {
        collection: v.optional(v.string()),
        category: v.optional(v.string()),
        family: v.optional(v.string()),
        searchTerm: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 100;

        // Group-level full-text search
        if (args.searchTerm) {
            return await ctx.db
                .query("productGroups")
                .withSearchIndex("search_displayName", (q) =>
                    q.search("displayName", args.searchTerm!)
                )
                .take(limit);
        }

        if (args.family) {
            return await ctx.db
                .query("productGroups")
                .withIndex("by_family", (q) => q.eq("family", args.family!))
                .take(limit);
        }

        if (args.category) {
            return await ctx.db
                .query("productGroups")
                .withIndex("by_category", (q) => q.eq("category", args.category!))
                .take(limit);
        }

        if (args.collection) {
            return await ctx.db
                .query("productGroups")
                .withIndex("by_collection", (q) => q.eq("bottleCollection", args.collection!))
                .take(limit);
        }

        return await ctx.db.query("productGroups").take(limit);
    },
});

/**
 * Fetch a single product group by its slug, plus all variant products.
 * Used by the PDP route: /products/[slug]
 */
export const getProductGroup = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const group = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();

        if (!group) return null;

        // Use the by_productGroupId index — avoids a full 2,285-product table scan
        const variants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
            .collect();

        return { group, variants };
    },
});

/**
 * Fetch just the variant products for a known group ID.
 * Used by the PDP variant selector to load options.
 */
export const getVariantsForGroup = query({
    args: { groupId: v.id("productGroups") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", args.groupId))
            .collect();
    },
});

/**
 * Returns groups by family — for family-level browsing pages.
 */
export const getGroupsByFamily = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
    },
});

// Applicator bucket suffixes in slugs (e.g. cylinder-5ml-clear-13-415-spray ends with -spray)
const APPLICATOR_BUCKET_SUFFIXES = ["-spray", "-rollon", "-dropper", "-lotionpump", "-reducer", "-glasswand", "-glassapplicator", "-capclosure"] as const;

// Cylinder 5ml roll-on: only Clear and Blue (no Amber — 5ml Amber is Tulip-shaped only)
const CYLINDER_5ML_ROLLON_ALLOWED = new Set(["Clear", "Blue", "Cobalt Blue"]);
const BLUE_ALIASES = new Set(["Blue", "Cobalt Blue"]);

/**
 * Returns sibling product groups — same family + capacityMl + neckThreadSize + applicator bucket, different glass color.
 * Used by the PDP to show glass color swatches and navigate between color variants.
 * Filters by applicator bucket so spray/roll-on pages don't show each other's color options.
 * For Cylinder 5ml roll-on: only Clear and Blue (no Amber — 5ml Amber is Tulip-shaped only).
 * neckThreadSize is optional for backward compatibility; when provided only same-thread siblings are returned.
 */
export const getSiblingGroups = query({
    args: {
        family: v.string(),
        capacityMl: v.number(),
        excludeSlug: v.string(),
        neckThreadSize: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const all = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
        const bucketSuffix = APPLICATOR_BUCKET_SUFFIXES.find((s) => args.excludeSlug.endsWith(s));
        const hasKnownSuffix = (slug: string) => APPLICATOR_BUCKET_SUFFIXES.some((s) => slug.endsWith(s));
        let filtered = all.filter(
            (g) =>
                g.capacityMl === args.capacityMl &&
                g.slug !== args.excludeSlug &&
                (args.neckThreadSize == null || g.neckThreadSize === args.neckThreadSize) &&
                (
                    bucketSuffix
                        ? g.slug.endsWith(bucketSuffix)
                        : !hasKnownSuffix(g.slug)
                )
        );

        // Cylinder 5ml roll-on: only Clear and Blue; deduplicate (one per canonical color)
        const isCylinder5mlRollon =
            args.family === "Cylinder" &&
            args.capacityMl === 5 &&
            bucketSuffix === "-rollon";
        if (isCylinder5mlRollon) {
            filtered = filtered.filter((g) => CYLINDER_5ML_ROLLON_ALLOWED.has(g.color ?? ""));
            // Deduplicate: one per canonical color (Blue + Cobalt Blue → single "Blue")
            const seen = new Set<string>();
            filtered = filtered.filter((g) => {
                const c = g.color ?? "";
                const canonical = BLUE_ALIASES.has(c) ? "Blue" : c;
                if (seen.has(canonical)) return false;
                seen.add(canonical);
                return true;
            });
        }

        // Global color dedupe for sibling swatches:
        // if multiple groups have same color (e.g. data artifacts), show only one swatch per color.
        const seenColor = new Set<string>();
        filtered = filtered.filter((g) => {
            const c = g.color ?? "";
            const canonical = BLUE_ALIASES.has(c) ? "Blue" : c;
            if (seenColor.has(canonical)) return false;
            seenColor.add(canonical);
            return true;
        });

        return filtered;
    },
});

/**
 * Data quality audit — scans for duplicates and misclassified component SKUs.
 * Returns flagged issues for review.
 */
export const auditDataQuality = query({
    args: {},
    handler: async (ctx) => {
        const allProducts = await ctx.db.query("products").collect();

        const issues: Array<{
            type: "duplicate_sku" | "duplicate_name" | "sku_mismatch" | "missing_price" | "missing_category";
            severity: "high" | "medium" | "low";
            graceSku: string;
            itemName: string;
            detail: string;
        }> = [];

        // 1. Check for duplicate graceSku values
        const skuMap = new Map<string, typeof allProducts>();
        for (const p of allProducts) {
            const key = p.graceSku;
            if (!skuMap.has(key)) skuMap.set(key, []);
            skuMap.get(key)!.push(p);
        }
        for (const [sku, products] of skuMap) {
            if (products.length > 1) {
                issues.push({
                    type: "duplicate_sku",
                    severity: "high",
                    graceSku: sku,
                    itemName: products[0].itemName,
                    detail: `${products.length} products share graceSku "${sku}": ${products.map(p => p.websiteSku).join(", ")}`,
                });
            }
        }

        // 2. Check for near-duplicate item names within same category
        const nameMap = new Map<string, typeof allProducts>();
        for (const p of allProducts) {
            const normalizedName = p.itemName.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (!nameMap.has(normalizedName)) nameMap.set(normalizedName, []);
            nameMap.get(normalizedName)!.push(p);
        }
        for (const [, products] of nameMap) {
            if (products.length > 1) {
                const skus = products.map(p => p.graceSku);
                if (new Set(skus).size === skus.length) {
                    issues.push({
                        type: "duplicate_name",
                        severity: "medium",
                        graceSku: products[0].graceSku,
                        itemName: products[0].itemName,
                        detail: `${products.length} products with identical normalized name: ${skus.join(", ")}`,
                    });
                }
            }
        }

        // 3. Check for SKU prefix vs category mismatches in components
        const skuCategoryChecks: Array<{ prefix: string; expectedKeywords: string[]; wrongLabel: string }> = [
            { prefix: "SPR", expectedKeywords: ["sprayer"], wrongLabel: "not labeled as Sprayer" },
            { prefix: "AST", expectedKeywords: ["sprayer", "atomizer"], wrongLabel: "not labeled as Sprayer/Atomizer" },
            { prefix: "ASP", expectedKeywords: ["sprayer", "atomizer"], wrongLabel: "not labeled as Sprayer/Atomizer" },
            { prefix: "ATM", expectedKeywords: ["sprayer", "atomizer"], wrongLabel: "not labeled as Sprayer/Atomizer" },
            { prefix: "DRP", expectedKeywords: ["dropper"], wrongLabel: "not labeled as Dropper" },
            { prefix: "LPM", expectedKeywords: ["lotion", "pump"], wrongLabel: "not labeled as Lotion Pump" },
            { prefix: "RDC", expectedKeywords: ["reducer"], wrongLabel: "not labeled as Reducer" },
            { prefix: "ROL", expectedKeywords: ["roller", "roll"], wrongLabel: "not labeled as Roller" },
        ];

        for (const p of allProducts) {
            if (p.category !== "Component") continue;
            const sku = p.graceSku.toUpperCase();
            for (const check of skuCategoryChecks) {
                if (sku.includes(`-${check.prefix}-`) || sku.includes(`-${check.prefix}`)) {
                    const name = p.itemName.toLowerCase();
                    const hasKeyword = check.expectedKeywords.some(kw => name.includes(kw));
                    if (!hasKeyword) {
                        issues.push({
                            type: "sku_mismatch",
                            severity: "medium",
                            graceSku: p.graceSku,
                            itemName: p.itemName,
                            detail: `SKU contains "${check.prefix}" but item name is ${check.wrongLabel}: "${p.itemName}"`,
                        });
                    }
                }
            }

            // Check for CAP-prefixed SKUs that are actually sprayers/bulbs
            if (sku.includes("-CAP-")) {
                const name = p.itemName.toLowerCase();
                if (name.includes("sprayer") || name.includes("bulb") || name.includes("atomizer")) {
                    issues.push({
                        type: "sku_mismatch",
                        severity: "high",
                        graceSku: p.graceSku,
                        itemName: p.itemName,
                        detail: `SKU has "CAP" prefix but item is a sprayer/bulb: "${p.itemName}"`,
                    });
                }
            }

            // 4. Check for missing prices
            if (p.webPrice1pc == null || p.webPrice1pc === 0) {
                issues.push({
                    type: "missing_price",
                    severity: "low",
                    graceSku: p.graceSku,
                    itemName: p.itemName,
                    detail: "Missing webPrice1pc",
                });
            }
        }

        // Sort: high severity first, then medium, then low
        const severityOrder = { high: 0, medium: 1, low: 2 };
        issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return {
            totalProducts: allProducts.length,
            issueCount: issues.length,
            highSeverity: issues.filter(i => i.severity === "high").length,
            mediumSeverity: issues.filter(i => i.severity === "medium").length,
            lowSeverity: issues.filter(i => i.severity === "low").length,
            issues: issues.slice(0, 100),
        };
    },
});

/**
 * Audit applicator values for schema v1.2 — find values not in the constrained union.
 * Run BEFORE deploying the constrained applicator field.
 * Uses pagination to avoid 16MB read limit.
 * Usage: npx convex run products:auditApplicatorValues
 */
export const auditApplicatorValues = action({
    args: {},
    handler: async (ctx) => {
        const allowed = new Set([
            "Metal Roller", "Plastic Roller",
            "Fine Mist Sprayer", "Perfume Spray Pump",
            "Atomizer", "Antique Bulb Sprayer", "Antique Bulb Sprayer with Tassel",
            "Lotion Pump", "Dropper", "Reducer",
            "Glass Stopper", "Glass Rod",
            "Cap/Closure", "Applicator Cap", "Metal Atomizer", "N/A",
        ]);
        const values = new Set<string>();
        let cursor: string | null = null;
        let total = 0;

        while (true) {
            const result: {
                page: Array<{ applicator?: string | null }>;
                isDone: boolean;
                continueCursor: string;
            } = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: 200,
            });
            for (const p of result.page) {
                total++;
                if (p.applicator) values.add(p.applicator);
            }
            if (result.isDone) break;
            cursor = result.continueCursor;
        }

        const violations = [...values].filter((val) => !allowed.has(val));
        return { allValues: [...values].sort(), violations, total };
    },
});

/**
 * Export a page of products for CSV/JSON dump. Used by scripts/export_products_csv.mjs
 */
export const getProductExportPage = action({
    args: {
        cursor: v.union(v.string(), v.null()),
        numItems: v.number(),
    },
    handler: async (ctx, args): Promise<{
        page: Array<Record<string, unknown>>;
        isDone: boolean;
        continueCursor: string;
    }> => {
        return await ctx.runQuery(internal.migrations.getProductPage, {
            cursor: args.cursor,
            numItems: args.numItems,
        }) as {
            page: Array<Record<string, unknown>>;
            isDone: boolean;
            continueCursor: string;
        };
    },
});
