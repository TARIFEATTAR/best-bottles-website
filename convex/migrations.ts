import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT GROUPING MIGRATION — Phase 1
//
// Groups all flat SKU records into parent productGroups.
// Grouping key: family + capacityMl + color
//
// Run via: node scripts/run_grouping_migration.mjs
// ─────────────────────────────────────────────────────────────────────────────

function buildSlug(
    family: string | null,
    capacityMl: number | null,
    color: string | null,
    category: string
): string {
    const f = (family || category || "unknown")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    const c = capacityMl != null ? `${capacityMl}ml` : "0ml";
    const col = (color || "mixed")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return `${f}-${c}-${col}`;
}

function buildDisplayName(
    family: string | null,
    capacity: string | null,
    color: string | null,
    category: string
): string {
    const parts = [
        family || category,
        capacity && capacity !== "0 ml (0 oz)" ? capacity : null,
        color,
    ].filter(Boolean);
    return parts.join(" ");
}

function buildGroupKey(
    family: string | null,
    capacityMl: number | null,
    color: string | null,
    category: string
): string {
    return [family || category, capacityMl ?? "null", color || "null"].join("|");
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Paginated read of products — keeps each call under the 16MB read limit */
export const getProductPage = internalQuery({
    args: {
        cursor: v.union(v.string(), v.null()),
        numItems: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.query("products").paginate({
            numItems: args.numItems,
            cursor: args.cursor as any,
        });
    },
});

/** Clear all productGroups, then insert the new ones */
export const insertGroups = internalMutation({
    args: {
        groups: v.array(v.object({
            slug: v.string(),
            displayName: v.string(),
            family: v.string(),
            capacity: v.union(v.string(), v.null()),
            capacityMl: v.union(v.number(), v.null()),
            color: v.union(v.string(), v.null()),
            category: v.string(),
            bottleCollection: v.union(v.string(), v.null()),
            neckThreadSize: v.union(v.string(), v.null()),
            variantCount: v.number(),
            priceRangeMin: v.union(v.number(), v.null()),
            priceRangeMax: v.union(v.number(), v.null()),
        })),
    },
    handler: async (ctx, args) => {
        // Clear existing groups
        const existing = await ctx.db.query("productGroups").collect();
        for (const g of existing) {
            await ctx.db.delete(g._id);
        }
        // Insert new groups
        for (const def of args.groups) {
            await ctx.db.insert("productGroups", def);
        }
        return { inserted: args.groups.length };
    },
});

/** Patch a page of products with their productGroupId */
export const linkPage = internalMutation({
    args: {
        links: v.array(v.object({
            id: v.id("products"),
            groupId: v.id("productGroups"),
        })),
    },
    handler: async (ctx, args) => {
        for (const { id, groupId } of args.links) {
            await ctx.db.patch(id, { productGroupId: groupId });
        }
        return { patched: args.links.length };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Build product groups (action — paginates to avoid 16MB read limit)
// ─────────────────────────────────────────────────────────────────────────────
export const buildProductGroups = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;

        type GroupDef = {
            slug: string;
            displayName: string;
            family: string;
            capacity: string | null;
            capacityMl: number | null;
            color: string | null;
            category: string;
            bottleCollection: string | null;
            neckThreadSize: string | null;
            variantCount: number;
            priceRangeMin: number | null;
            priceRangeMax: number | null;
        };

        const groupMap = new Map<string, GroupDef>();
        let totalProducts = 0;

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            });

            for (const p of result.page) {
                const key = buildGroupKey(p.family, p.capacityMl, p.color, p.category);

                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        slug: buildSlug(p.family, p.capacityMl, p.color, p.category),
                        displayName: buildDisplayName(p.family, p.capacity, p.color, p.category),
                        family: p.family || p.category,
                        capacity: p.capacity ?? null,
                        capacityMl: p.capacityMl ?? null,
                        color: p.color ?? null,
                        category: p.category,
                        bottleCollection: p.bottleCollection ?? null,
                        neckThreadSize: p.neckThreadSize ?? null,
                        variantCount: 0,
                        priceRangeMin: null,
                        priceRangeMax: null,
                    });
                }

                const group = groupMap.get(key)!;
                group.variantCount++;

                const price = p.webPrice1pc;
                if (price != null && price > 0) {
                    if (group.priceRangeMin == null || price < group.priceRangeMin) {
                        group.priceRangeMin = price;
                    }
                    if (group.priceRangeMax == null || price > group.priceRangeMax) {
                        group.priceRangeMax = price;
                    }
                }

                totalProducts++;
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        const groupsArray = Array.from(groupMap.values());
        await ctx.runMutation(internal.migrations.insertGroups, { groups: groupsArray });

        return {
            groupsCreated: groupMap.size,
            totalProducts,
            message: `Created ${groupMap.size} product groups from ${totalProducts} SKUs.`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Link products to their groups (action — paginates)
// ─────────────────────────────────────────────────────────────────────────────
export const linkProductsToGroups = action({
    args: {},
    handler: async (ctx) => {
        // Load all groups into a slug → _id map (groups are small, ~230 docs)
        const groups: any[] = await ctx.runQuery(internal.migrations.getAllGroups, {});
        const slugToId = new Map<string, any>(groups.map((g: any) => [g.slug, g._id]));

        if (slugToId.size === 0) {
            return { linked: 0, skipped: 0, message: "No product groups found. Run buildProductGroups first." };
        }

        const PAGE_SIZE = 200;
        let cursor: string | null = null;
        let isDone = false;
        let linked = 0;
        let skipped = 0;

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            });

            const links: { id: any; groupId: any }[] = [];
            for (const p of result.page) {
                const slug = buildSlug(p.family, p.capacityMl, p.color, p.category);
                const groupId = slugToId.get(slug);
                if (groupId) {
                    links.push({ id: p._id, groupId });
                    linked++;
                } else {
                    skipped++;
                }
            }

            if (links.length > 0) {
                await ctx.runMutation(internal.migrations.linkPage, { links });
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        return {
            linked,
            skipped,
            message: `Linked ${linked} products. ${skipped > 0 ? `${skipped} unmatched.` : "All matched."}`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// FIELD ENRICHMENT MIGRATION — Phase 1.5
//
// Derives `applicator` and `color` from graceSku + itemName for all GB/LB products.
// Run BEFORE re-running buildProductGroups so groups split by glass color.
// ─────────────────────────────────────────────────────────────────────────────

const APPLICATOR_MAP: Record<string, string> = {
    ROL: "Plastic Roller",
    MRL: "Metal Roller",
    RON: "Plastic Roller",   // Boston Round family variant
    MRO: "Metal Roller",     // Boston Round family variant
    RBL: "Plastic Roller",   // Elegant family variant
    SPR: "Fine Mist Sprayer",
    ASP: "Antique Bulb Sprayer",
    AST: "Antique Bulb Sprayer with Tassel",
    LPM: "Lotion Pump",
    DRP: "Dropper",
    RDC: "Reducer",
    ATM: "Atomizer",
};

const COLOR_MAP: Record<string, string> = {
    CLR: "Clear",
    FRS: "Frosted",
    AMB: "Amber",
    BLU: "Blue",
    CBL: "Cobalt Blue",
    BLK: "Black",
    WHT: "White",
    GRN: "Green",
    PNK: "Pink",
};

function deriveApplicator(graceSku: string, itemName: string): string | null {
    const parts = graceSku.split("-");
    const prefix = parts[0];
    if (prefix !== "GB" && prefix !== "LB") return null;

    // Pass 1: SKU segment
    const fromSku = APPLICATOR_MAP[parts[4]];
    if (fromSku) return fromSku;

    // Pass 2: item name keywords
    const n = itemName.toLowerCase();
    if (n.includes("metal roller")) return "Metal Roller";
    if (n.includes("roller ball") || n.includes("plastic roller")) return "Plastic Roller";
    if (n.includes("tassel")) return "Antique Bulb Sprayer with Tassel";
    if (n.includes("vintage") || n.includes("antique") || n.includes("bulb spray")) return "Antique Bulb Sprayer";
    if (n.includes("atomizer")) return "Atomizer";
    if (n.includes("fine mist") || n.includes("mist sprayer") || n.includes("spray pump")) return "Fine Mist Sprayer";
    if (n.includes("treatment pump") || n.includes("lotion pump")) return "Lotion Pump";
    if (n.includes("dropper")) return "Dropper";
    if (n.includes("reducer")) return "Reducer";
    if (n.includes("glass stopper")) return "Glass Stopper";
    if (n.includes("glass rod")) return "Glass Rod";
    return null;
}

function deriveColor(graceSku: string): string | null {
    const parts = graceSku.split("-");
    const prefix = parts[0];
    if (prefix !== "GB" && prefix !== "LB") return null;
    return COLOR_MAP[parts[2]] || null;
}

/** Patch a batch of products with derived applicator + color */
export const patchProductsBatch = internalMutation({
    args: {
        patches: v.array(v.object({
            id: v.id("products"),
            applicator: v.union(v.string(), v.null()),
            color: v.union(v.string(), v.null()),
        })),
    },
    handler: async (ctx, args) => {
        for (const { id, applicator, color } of args.patches) {
            await ctx.db.patch(id, {
                ...(applicator !== null ? { applicator } : {}),
                ...(color !== null ? { color } : {}),
            });
        }
        return { patched: args.patches.length };
    },
});

/** Action: paginate through all products, derive and patch applicator + color */
export const enrichProductFields = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;
        let totalPatched = 0;
        let totalSkipped = 0;

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            });

            const patches: { id: any; applicator: string | null; color: string | null }[] = [];
            for (const p of result.page) {
                const applicator = deriveApplicator(p.graceSku || "", p.itemName || "");
                const color = deriveColor(p.graceSku || "");
                if (applicator !== null || color !== null) {
                    patches.push({ id: p._id, applicator, color });
                    totalPatched++;
                } else {
                    totalSkipped++;
                }
            }

            if (patches.length > 0) {
                await ctx.runMutation(internal.migrations.patchProductsBatch, { patches });
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        return {
            patched: totalPatched,
            skipped: totalSkipped,
            message: `Enriched ${totalPatched} products. ${totalSkipped} had no derivable data (small vials/caps — expected).`,
        };
    },
});

/** Load all productGroups (small collection ~230 docs) */
export const getAllGroups = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("productGroups").collect();
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CHECK
// ─────────────────────────────────────────────────────────────────────────────
/** Count a page of products and how many are linked */
export const countProductPage = internalQuery({
    args: {
        cursor: v.union(v.string(), v.null()),
        numItems: v.number(),
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.query("products").paginate({
            numItems: args.numItems,
            cursor: args.cursor as any,
        });
        let linked = 0;
        for (const p of result.page) {
            if (p.productGroupId != null) linked++;
        }
        return { count: result.page.length, linked, isDone: result.isDone, continueCursor: result.continueCursor };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// BSR DROPPER / CAP FIX — Phase 1.6
//
// The fitment source data assigned ALL 20-400 dropper sizes to ALL Boston Round
// bottles, regardless of bottle height. Fix:
//   15ml BSR (18-400, ~68mm) → remove 90mm dropper (CMP-DRP-BLK-18400-90MM)
//   30ml BSR (20-400, ~73mm) → remove 90mm droppers + 2oz cap
//   60ml BSR (20-400, ~90mm) → remove 76mm droppers + 1oz cap
//
// Run via: node scripts/run_bsr_fix.mjs
// ─────────────────────────────────────────────────────────────────────────────

const BSR_REMOVE_15ML = new Set([
    "CMP-DRP-BLK-18400-90MM",
]);

const BSR_REMOVE_30ML = new Set([
    "CMP-DRP-WHT-20400-90",
    "CMP-DRP-BKSL-20400-90",
    "CMP-DRP-WTGD-20400-90",
    "CMP-DRP-BKGD-20400-90",
    "CMP-DRP-WTSL-20400-90",
    "CMP-DRP-BLK-20400-90",
    "CMP-CAP-BLK-20-400-2OZ",
]);

const BSR_REMOVE_60ML = new Set([
    "CMP-DRP-WHT-20400-76",
    "CMP-DRP-BKSL-20400-76",
    "CMP-DRP-WTGD-20400-76",
    "CMP-DRP-BKGD-20400-76",
    "CMP-DRP-WTSL-20400-76",
    "CMP-DRP-BLK-20400-76MM-01",
    "CMP-CAP-BLK-20-400-1OZ",
]);

function getRemoveSet(capacityMl: number | null): Set<string> | null {
    if (capacityMl == null) return null;
    if (capacityMl <= 15) return BSR_REMOVE_15ML;
    if (capacityMl <= 35) return BSR_REMOVE_30ML;
    if (capacityMl >= 55) return BSR_REMOVE_60ML;
    return null;
}

/** Patch components array for a batch of products */
export const patchProductComponents = internalMutation({
    args: {
        patches: v.array(v.object({
            id: v.id("products"),
            components: v.any(),
        })),
    },
    handler: async (ctx, args) => {
        for (const { id, components } of args.patches) {
            await ctx.db.patch(id, { components });
        }
        return { patched: args.patches.length };
    },
});

/** Action: filter mismatched dropper/cap components from all Boston Round products */
export const fixBsrDroppers = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;
        let totalFixed = 0;
        let totalSkipped = 0;

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            });

            const patches: { id: any; components: any }[] = [];

            for (const p of result.page) {
                // Only process Boston Round products
                if (p.family !== "Boston Round") continue;

                const removeSet = getRemoveSet(p.capacityMl);
                if (!removeSet) { totalSkipped++; continue; }

                const original: any[] = Array.isArray(p.components) ? p.components : [];
                const filtered = original.filter((c: any) => {
                    const sku = c.grace_sku || c.sku || "";
                    return !removeSet.has(sku);
                });

                if (filtered.length < original.length) {
                    patches.push({ id: p._id, components: filtered });
                    totalFixed++;
                } else {
                    totalSkipped++;
                }
            }

            if (patches.length > 0) {
                await ctx.runMutation(internal.migrations.patchProductComponents, { patches });
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        return {
            fixed: totalFixed,
            skipped: totalSkipped,
            message: `Fixed ${totalFixed} Boston Round products. ${totalSkipped} skipped (non-BSR or no matching issue).`,
        };
    },
});

/** Verify the BSR dropper fix — check component counts per capacity */
export const verifyBsrFix = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;

        const BAD_FOR_30: Set<string> = new Set(["CMP-DRP-WHT-20400-90","CMP-DRP-BKSL-20400-90","CMP-DRP-WTGD-20400-90","CMP-DRP-BKGD-20400-90","CMP-DRP-WTSL-20400-90","CMP-DRP-BLK-20400-90","CMP-CAP-BLK-20-400-2OZ"]);
        const BAD_FOR_60: Set<string> = new Set(["CMP-DRP-WHT-20400-76","CMP-DRP-BKSL-20400-76","CMP-DRP-WTGD-20400-76","CMP-DRP-BKGD-20400-76","CMP-DRP-WTSL-20400-76","CMP-DRP-BLK-20400-76MM-01","CMP-CAP-BLK-20-400-1OZ"]);
        const BAD_FOR_15: Set<string> = new Set(["CMP-DRP-BLK-18400-90MM"]);

        const byCapacity: Record<string, { count: number; compCounts: Set<number>; issues: number }> = {};

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.getProductPage, { cursor, numItems: PAGE_SIZE });
            for (const p of result.page) {
                if (p.family !== "Boston Round") continue;
                const cap = p.capacity || "unknown";
                if (!byCapacity[cap]) byCapacity[cap] = { count: 0, compCounts: new Set(), issues: 0 };
                byCapacity[cap].count++;
                const comps: any[] = Array.isArray(p.components) ? p.components : [];
                byCapacity[cap].compCounts.add(comps.length);
                const badSet = cap.includes("15") ? BAD_FOR_15 : cap.includes("30") ? BAD_FOR_30 : BAD_FOR_60;
                for (const c of comps) {
                    if (badSet.has(c.grace_sku || "")) byCapacity[cap].issues++;
                }
            }
            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        const summary: Record<string, any> = {};
        for (const [cap, data] of Object.entries(byCapacity)) {
            summary[cap] = {
                products: data.count,
                componentCounts: [...data.compCounts].sort((a, b) => a - b),
                remainingBadComponents: data.issues,
                status: data.issues === 0 ? "CLEAN ✓" : `STILL HAS ${data.issues} ISSUES`,
            };
        }
        return summary;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// VIAL & FAMILY CLEANUP MIGRATION
//
// Fixes identified in taxonomy audit:
//   1. 1ml vials: thread "8-425" → "Plug" (no thread), clear bad components
//   2. 9 products misclassified as "Vial" family → Royal, Flair, Square
//
// Run via: npx convex run migrations:fixVialTaxonomy
// ─────────────────────────────────────────────────────────────────────────────

/** Batch-patch products with arbitrary field updates */
export const patchProductFields = internalMutation({
    args: {
        patches: v.array(v.object({
            id: v.id("products"),
            fields: v.any(),
        })),
    },
    handler: async (ctx, args) => {
        for (const { id, fields } of args.patches) {
            await ctx.db.patch(id, fields);
        }
        return { patched: args.patches.length };
    },
});

export const fixVialTaxonomy = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;
        const fixes: { id: any; fields: any; reason: string }[] = [];

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            });

            for (const p of result.page) {
                if (p.family !== "Vial" && p.family !== null) continue;

                const name = (p.itemName || "").toLowerCase();
                const sku = p.graceSku || "";

                // Fix 1: Reclassify Royal/Flair/Square bottles misassigned to Vial
                if (name.includes("royal design")) {
                    fixes.push({
                        id: p._id,
                        fields: { family: "Royal", bottleCollection: "Royal Collection" },
                        reason: `${sku} → Royal (was Vial)`,
                    });
                    continue;
                }
                if (name.includes("flair design")) {
                    fixes.push({
                        id: p._id,
                        fields: { family: "Flair", bottleCollection: "Flair Collection" },
                        reason: `${sku} → Flair (was Vial)`,
                    });
                    continue;
                }
                if (name.includes("square design")) {
                    fixes.push({
                        id: p._id,
                        fields: { family: "Square", bottleCollection: "Square Collection" },
                        reason: `${sku} → Square (was Vial)`,
                    });
                    continue;
                }

                // Fix 2: 1ml vials — plug closure, not threaded
                if (name.includes("vial style") && name.includes("1 ml")) {
                    const applicatorColor = name.includes("black applicator")
                        ? "Black"
                        : name.includes("white applicator")
                        ? "White"
                        : null;

                    const plugComponents = applicatorColor
                        ? [{
                            grace_sku: `CMP-PLUG-${applicatorColor === "Black" ? "BLK" : "WHT"}-VIAL`,
                            item_name: `${applicatorColor} plug applicator for 1ml vial`,
                            image_url: null,
                            price_1: null,
                            price_12: null,
                        }]
                        : [];

                    fixes.push({
                        id: p._id,
                        fields: {
                            neckThreadSize: "Plug",
                            components: plugComponents,
                            fitmentStatus: "plug-closure",
                        },
                        reason: `${sku} → thread "Plug", cleared ${(Array.isArray(p.components) ? p.components.length : 0)} bad 8-425 components`,
                    });
                }
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        // Apply fixes in batches
        const BATCH_SIZE = 50;
        for (let i = 0; i < fixes.length; i += BATCH_SIZE) {
            const batch = fixes.slice(i, i + BATCH_SIZE).map(f => ({
                id: f.id,
                fields: f.fields,
            }));
            await ctx.runMutation(internal.migrations.patchProductFields, { patches: batch });
        }

        return {
            totalFixed: fixes.length,
            details: fixes.map(f => f.reason),
            message: `Fixed ${fixes.length} products: vial thread sizes, misclassified families.`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// 9ML BLACK/WHITE GLASS REMOVAL
//
// Boss decision: discontinuing black and white glass for 9ml bottles.
// Valid 9ml colors: Amber, Blue, Clear, Frosted, Swirl (Swirl = same thread 17-415,
// same fitments — treat as color variant, not separate family).
//
// Run via: npx convex run migrations:remove9mlBlackWhite
// ─────────────────────────────────────────────────────────────────────────────

/** Delete products by ID */
export const deleteProductsBatch = internalMutation({
    args: {
        ids: v.array(v.id("products")),
    },
    handler: async (ctx, args) => {
        for (const id of args.ids) {
            await ctx.db.delete(id);
        }
        return { deleted: args.ids.length };
    },
});

export const remove9mlBlackWhite = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;
        const toDelete: { id: any; sku: string }[] = [];

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            });

            for (const p of result.page) {
                const sku = (p.graceSku || "").toUpperCase();
                const capacity = (p.capacity || "").toLowerCase();

                if (!capacity.includes("9 ml") && !capacity.includes("9ml")) continue;

                const isBlack = sku.includes("-BLK-9ML");
                const isWhite = sku.includes("-WHT-9ML");

                if (isBlack || isWhite) {
                    toDelete.push({ id: p._id, sku: p.graceSku || "" });
                }
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE).map(d => d.id);
            await ctx.runMutation(internal.migrations.deleteProductsBatch, { ids: batch });
        }

        return {
            deleted: toDelete.length,
            skus: toDelete.map(d => d.sku),
            message: `Removed ${toDelete.length} discontinued 9ml black/white glass products.`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// ADD MISSING VIAL PRODUCTS — from live site audit
//
// 2 products on bestbottles.com not in our DB:
//   1. GBVialAmb1o5WhtCapSht — 1.5ml amber, white cap, 13-425
//   2. GBVBlu1o9BlackCapSht — 5/8 dram blue, black cap, 13-425
//
// Run via: npx convex run migrations:addMissingVials
// ─────────────────────────────────────────────────────────────────────────────

export const addMissingVials = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 200;
        let cursor: string | null = null;
        let isDone = false;
        const existingSkus = new Set<string>();

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            });
            for (const p of result.page) {
                existingSkus.add((p.websiteSku || "").toLowerCase());
            }
            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        const newProducts = [
            {
                productId: null,
                websiteSku: "GBVialAmb1o5WhtCapSht",
                graceSku: "GB-VIA-AMB-1.5ML-WHT-S",
                category: "Glass Bottle",
                family: "Vial",
                shape: "Vial",
                color: "Amber",
                capacity: "2 ml (0.07 oz)",
                capacityMl: 2,
                capacityOz: 0.07,
                applicator: null,
                capColor: "White",
                trimColor: null,
                capStyle: "Short",
                neckThreadSize: "13-425",
                heightWithCap: "24 ±0.5 mm",
                heightWithoutCap: "22 ±0.5 mm",
                diameter: "16 ±0.5 mm",
                bottleWeightG: null,
                caseQuantity: null,
                qbPrice: null,
                webPrice1pc: 0.38,
                webPrice10pc: null,
                webPrice12pc: 0.36,
                stockStatus: "In Stock",
                itemName: "Vial design 1.5ml, Amber glass vial with white short cap. For use with perfume or fragrance oil, essential oil, aromatherapy, sample or trial size. Perfume sample vials for promotions. Price each",
                itemDescription: "Vial design 1.5ml, Amber glass vial with white short cap. For use with perfume or fragrance oil, essential oil, aromatherapy, sample or trial size. Perfume sample vials for promotions. Price each",
                imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBVialAmb1o5WhtCapSht.gif",
                productUrl: "https://www.bestbottles.com/product/Vial-design-1-o-5-ml-amber-glass-white-short-cap",
                dataGrade: "A",
                bottleCollection: "Vial & Sample Collection",
                fitmentStatus: "verified",
                components: [],
                graceDescription: "1.5ml amber glass vial with white short cap. Thread 13-425. Ideal for perfume samples and promotions.",
                verified: true,
                importSource: "live_site_audit_2026-02-25",
            },
            {
                productId: null,
                websiteSku: "GBVBlu1o9BlackCapSht",
                graceSku: "GB-VIA-BLU-3ML-BLK-S",
                category: "Glass Bottle",
                family: "Vial",
                shape: "Vial",
                color: "Blue",
                capacity: "3 ml (0.1 oz)",
                capacityMl: 3,
                capacityOz: 0.1,
                applicator: null,
                capColor: "Black",
                trimColor: null,
                capStyle: "Short",
                neckThreadSize: "13-425",
                heightWithCap: null,
                heightWithoutCap: null,
                diameter: null,
                bottleWeightG: null,
                caseQuantity: null,
                qbPrice: null,
                webPrice1pc: 1.08,
                webPrice10pc: null,
                webPrice12pc: 1.03,
                stockStatus: "In Stock",
                itemName: "Vial design 5/8 dram Blue glass vial with black short cap. For use with perfume or fragrance oil, essential oil, aromatherapy, sample or trial size. Perfume sample vials for promotions. Price each",
                itemDescription: "Vial design 5/8 dram Blue glass vial with black short cap. For use with perfume or fragrance oil, essential oil, aromatherapy, sample or trial size. Perfume sample vials for promotions. Price each",
                imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBVBlu1o9BlackCapSht.gif",
                productUrl: "https://www.bestbottles.com/product/Vial-design-5-8-dram-blue-glass-black-short-cap",
                dataGrade: "A",
                bottleCollection: "Vial & Sample Collection",
                fitmentStatus: "verified",
                components: [],
                graceDescription: "5/8 dram (3ml) blue glass vial with black short cap. Thread 13-425. Ideal for perfume samples and promotions.",
                verified: true,
                importSource: "live_site_audit_2026-02-25",
            },
        ];

        const added: string[] = [];
        const skipped: string[] = [];

        for (const product of newProducts) {
            if (existingSkus.has(product.websiteSku.toLowerCase())) {
                skipped.push(product.websiteSku);
            } else {
                await ctx.runMutation(internal.migrations.insertSingleProduct, { product });
                added.push(product.websiteSku);
            }
        }

        return {
            added,
            skipped,
            message: `Added ${added.length} products. ${skipped.length > 0 ? `Skipped ${skipped.length} (already exist).` : ""}`,
        };
    },
});

/** Insert a single product — used by addMissingVials */
export const insertSingleProduct = internalMutation({
    args: { product: v.any() },
    handler: async (ctx, args) => {
        await ctx.db.insert("products", args.product);
    },
});

export const checkMigrationStatus = action({
    args: {},
    handler: async (ctx) => {
        const groups: any[] = await ctx.runQuery(internal.migrations.getAllGroups, {});

        let total = 0;
        let linked = 0;
        let cursor: string | null = null;
        let isDone = false;

        while (!isDone) {
            const result: any = await ctx.runQuery(internal.migrations.countProductPage, {
                cursor,
                numItems: 100,
            });
            total += result.count;
            linked += result.linked;
            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        return {
            productGroups: groups.length,
            totalProducts: total,
            productsLinked: linked,
            productsUnlinked: total - linked,
            isComplete: groups.length > 0 && linked === total,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH KNOWLEDGE BASE — Fix stale/incorrect entries
// Run: npx convex run migrations:patchKnowledgeBase
// ─────────────────────────────────────────────────────────────────────────────

export const patchKnowledgeBase = mutation({
    args: {},
    handler: async (ctx) => {
        const patched: string[] = [];

        // Fix Boston Round narrative (was: "from 10ml through 500ml")
        const brEntry = await ctx.db
            .query("graceKnowledge")
            .withSearchIndex("search_content", (q) => q.search("content", "Boston Round bottles are the industry standard"))
            .first();
        if (brEntry) {
            await ctx.db.patch(brEntry._id, {
                content: "Boston Round bottles are the industry standard for essential oils, fragrance oils, and tinctures. They feature a rounded shoulder and thick UV-resistant glass walls designed for long-term formula stability. Available in amber (for UV protection), clear, and cobalt blue. Best Bottles stocks Boston Rounds in three sizes: 15ml (18-400 thread), 30ml (20-400 thread), and 60ml (20-400 thread). The 15ml uses an 18-400 neck, while the 30ml and 60ml use the standard 20-400 neck — this is important for fitment matching. Compatible closures include dropper caps, spray tops, roller balls, and lotion pumps (matched to the correct thread size).",
            });
            patched.push("Boston Round narrative — corrected sizes and thread info");
        }

        // Fix thread size system (was: only 4 threads, 20-400 "exclusively" Boston Round)
        const threadEntry = await ctx.db
            .query("graceKnowledge")
            .withSearchIndex("search_content", (q) => q.search("content", "Thread Size System"))
            .first();
        if (threadEntry) {
            await ctx.db.patch(threadEntry._id, {
                title: "Thread Size System — Complete Neck Standards",
                content: `Best Bottles uses several neck thread systems. This is critical operational knowledge for fitment matching:

18-415 (18mm diameter, style 415):
- The most common neck size in the Best Bottles portfolio
- Used by: Elegant (60ml, 100ml), Cylinder (28ml+), Diva, Slim (30ml+), Empire, most decorative families
- Compatible closures: 18-415 sprayers, 18-415 droppers, 18-415 lotion pumps, 18-415 roll-on caps, 18-415 caps
- Note: 18-415 and 18-400 are NOT interchangeable despite similar diameter

18-400 (18mm diameter, style 400):
- Used by: Boston Round 15ml
- Compatible closures: 18-400 droppers, 18-400 caps
- IMPORTANT: 18-400 is NOT the same as 18-415 — different thread pitch. Do not mix them.

13-415 (13mm diameter, style 415):
- Narrow neck for small-capacity bottles (5ml–15ml range)
- Used by: mini Cylinder and Elegant families, Sleek 5ml/8ml, sample/trial sizes
- Compatible closures: 13-415 droppers, 13-415 mini caps
- Ideal for: perfume testers, sample kits, travel minis

13-425 (13mm diameter, style 425):
- Used by: Vial and Dram families (1ml, 1.5ml, 3ml, 4ml)
- Compatible closures: short caps (black/white), plug caps, small droppers
- Ideal for: perfume samples, essential oil testers, dram bottles

15-415 (15mm diameter, style 415):
- Used by: Elegant 15ml and 30ml, Circle 15ml and 30ml
- Compatible closures: 15-415 sprayers, 15-415 caps
- Note: Do not confuse with 13-415 or 18-415

17-415 (17mm diameter, style 415):
- Mid-range neck for specialty sizes
- Used by: some Slim and Cylinder variants (Cylinder 9ml)
- Less common but important to not confuse with 18-415

20-400 (20mm diameter, style 400):
- Standard pharmaceutical/essential oil neck
- Used by: Boston Round 30ml and 60ml
- Compatible closures: 20-400 sprayers, 20-400 droppers, 20-400 roll-on caps, 20-400 lotion pumps
- Note: This is the universal essential oil bottle standard

CRITICAL RULE: Thread size must match exactly. A 18-415 closure will not fit a 20-400 bottle and vice versa. Always call checkCompatibility or getFamilyOverview to verify — never guess from memory.`,
                tags: ["thread size", "neck size", "18-415", "18-400", "13-415", "13-425", "15-415", "17-415", "20-400", "fitment", "compatibility", "critical"],
            });
            patched.push("Thread size system — added 18-400, 13-425, 15-415; fixed 20-400 description");
        }

        // Fix wellness talking point (was: "from 10ml samples through 120ml")
        const wellnessEntry = await ctx.db
            .query("graceKnowledge")
            .withSearchIndex("search_content", (q) => q.search("content", "adaptogen and herbal tincture"))
            .first();
        if (wellnessEntry) {
            await ctx.db.patch(wellnessEntry._id, {
                content: wellnessEntry.content.replace(
                    /We have them from 10ml samples all the way through 120ml treatment sizes/,
                    "We carry them in 15ml, 30ml, and 60ml — the most popular sizes for tinctures and treatment oils"
                ),
            });
            patched.push("Wellness talking point — corrected Boston Round size range");
        }

        return {
            success: true,
            patched,
            message: patched.length === 0
                ? "No stale entries found."
                : `Patched ${patched.length} entries: ${patched.join("; ")}`,
        };
    },
});
