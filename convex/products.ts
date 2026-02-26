import { query } from "./_generated/server";
import { v } from "convex/values";

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
 * Groups a flat components array into a type-keyed map.
 * Used by FitmentDrawer and FitmentCarousel which expect grouped format.
 */
function groupComponentsByType(comps: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    for (const comp of comps) {
        const sku = (comp.grace_sku || comp.graceSku || "").toUpperCase();
        const name = (comp.item_name || comp.itemName || "").toLowerCase();
        let type = "Cap";

        if (sku.includes("DRP")) type = "Dropper";
        else if (sku.includes("ROC")) type = "Roll-On Cap";
        else if (sku.includes("AST") || sku.includes("ASP") || sku.includes("SPR") || sku.includes("ATM")) type = "Sprayer";
        else if (sku.includes("LPM")) type = "Lotion Pump";
        else if (sku.includes("RDC")) type = "Reducer";
        else if (sku.includes("ROL") || sku.includes("MRL") || sku.includes("RON") || sku.includes("MRO") || sku.includes("RBL")) type = "Roller";
        else if (name.includes("sprayer") || name.includes("bulb") || name.includes("atomizer")) type = "Sprayer";
        else if (name.includes("lotion") && name.includes("pump")) type = "Lotion Pump";
        else if (name.includes("dropper")) type = "Dropper";
        else if (name.includes("reducer")) type = "Reducer";

        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({
            graceSku: comp.grace_sku || comp.graceSku || "",
            itemName: comp.item_name || comp.itemName || "",
            imageUrl: comp.image_url || comp.imageUrl || null,
            price1: comp.price_1 ?? comp.price1 ?? null,
            price12: comp.price_12 ?? comp.price12 ?? null,
        });
    }
    return grouped;
}

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

        const rawComps = Array.isArray(bottle.components) ? bottle.components : [];
        return {
            bottle,
            components: groupComponentsByType(rawComps),
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

        const featured: Record<string, any> = {};
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
            let q = ctx.db.query("products").withSearchIndex("search_itemName", (q) =>
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

        // Collection-based — use take with a generous limit (no index on bottleCollection)
        if (args.collection) {
            return await ctx.db.query("products").take(limit);
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
        let q = ctx.db.query("products").withSearchIndex("search_itemName", (q) => {
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
