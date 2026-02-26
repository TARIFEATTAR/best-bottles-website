import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Minimal types for paginated product reads
interface RawProduct {
    _id: Id<"products">;
    graceSku?: string;
    websiteSku?: string;
    itemName?: string;
    family?: string;
    capacity?: string;
    capacityMl?: number;
    color?: string;
    category?: string;
    bottleCollection?: string;
    neckThreadSize?: string;
    webPrice1pc?: number;
    productGroupId?: string;
    components?: unknown[];
}

interface PageResult {
    page: RawProduct[];
    isDone: boolean;
    continueCursor: string;
}

interface GroupRecord {
    _id: Id<"productGroups">;
    slug: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT GROUPING MIGRATION — Phase 1
//
// Groups all flat SKU records into parent productGroups.
// Grouping key:
//   Bottles (Glass Bottle, Lotion Bottle, Aluminum Bottle):
//     family + capacityMl + color + neckThreadSize
//     → slug: e.g. cylinder-5ml-clear-13-415
//   Components / caps / applicators:
//     family + capacityMl + color  (thread intentionally excluded — they serve multiple necks)
//     → slug: e.g. cap-0ml-black
//
// Run via: node scripts/run_grouping_migration.mjs
// IMPORTANT: Run fixCylinder5mlData BEFORE this migration to ensure clean source data.
// ─────────────────────────────────────────────────────────────────────────────

// Bottle categories that should be split by neckThreadSize.
// Components/caps/sprayers intentionally serve multiple thread sizes and should NOT split.
const BOTTLE_CATEGORIES = new Set(["Glass Bottle", "Lotion Bottle", "Aluminum Bottle"]);

function buildSlug(
    family: string | null,
    capacityMl: number | null,
    color: string | null,
    category: string,
    neckThreadSize: string | null
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
    if (BOTTLE_CATEGORIES.has(category) && neckThreadSize) {
        const thread = neckThreadSize
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        return `${f}-${c}-${col}-${thread}`;
    }
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
    category: string,
    neckThreadSize: string | null
): string {
    const parts: (string | number)[] = [family || category, capacityMl ?? "null", color || "null"];
    if (BOTTLE_CATEGORIES.has(category)) {
        parts.push(neckThreadSize || "null");
    }
    return parts.join("|");
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
            cursor: args.cursor as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;

            for (const p of result.page) {
                const key = buildGroupKey(p.family ?? null, p.capacityMl ?? null, p.color ?? null, p.category ?? "unknown", p.neckThreadSize ?? null);

                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        slug: buildSlug(p.family ?? null, p.capacityMl ?? null, p.color ?? null, p.category ?? "unknown", p.neckThreadSize ?? null),
                        displayName: buildDisplayName(p.family ?? null, p.capacity ?? null, p.color ?? null, p.category ?? "unknown"),
                        family: p.family || p.category || "unknown",
                        capacity: p.capacity ?? null,
                        capacityMl: p.capacityMl ?? null,
                        color: p.color ?? null,
                        category: p.category ?? "unknown",
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
        const groups = await ctx.runQuery(internal.migrations.getAllGroups, {}) as GroupRecord[];
        const slugToId = new Map<string, Id<"productGroups">>(groups.map((g) => [g.slug, g._id]));

        if (slugToId.size === 0) {
            return { linked: 0, skipped: 0, message: "No product groups found. Run buildProductGroups first." };
        }

        const PAGE_SIZE = 200;
        let cursor: string | null = null;
        let isDone = false;
        let linked = 0;
        let skipped = 0;

        while (!isDone) {
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;

            const links: { id: Id<"products">; groupId: Id<"productGroups"> }[] = [];
            for (const p of result.page) {
                const slug = buildSlug(p.family ?? null, p.capacityMl ?? null, p.color ?? null, p.category ?? "unknown", p.neckThreadSize ?? null);
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
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;

            const patches: { id: Id<"products">; applicator: string | null; color: string | null }[] = [];
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

/** Get products for a group — used to aggregate applicatorTypes */
export const getProductsByGroupId = internalQuery({
    args: { groupId: v.id("productGroups") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", args.groupId))
            .collect();
    },
});

/** Patch productGroups with applicatorTypes — Option A applicator-first */
export const patchApplicatorTypesBatch = internalMutation({
    args: {
        patches: v.array(v.object({
            groupId: v.id("productGroups"),
            applicatorTypes: v.array(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        for (const { groupId, applicatorTypes } of args.patches) {
            await ctx.db.patch(groupId, { applicatorTypes });
        }
        return { patched: args.patches.length };
    },
});

/**
 * Populate applicatorTypes on each productGroup from its variant products.
 * Run AFTER linkProductsToGroups. Used for Option A applicator-first catalog filter.
 * Run via: npx convex run migrations:populateApplicatorTypes
 */
export const populateApplicatorTypes = action({
    args: {},
    handler: async (ctx) => {
        const groups = (await ctx.runQuery(internal.migrations.getAllGroups, {})) as Array<{ _id: Id<"productGroups"> }>;
        const patches: { groupId: Id<"productGroups">; applicatorTypes: string[] }[] = [];
        const BATCH = 50;

        for (const g of groups) {
            const products = await ctx.runQuery(internal.migrations.getProductsByGroupId, { groupId: g._id });
            const applicators = new Set<string>();
            for (const p of products) {
                const appl = (p as { applicator?: string | null }).applicator;
                if (appl && appl.trim()) applicators.add(appl.trim());
            }
            patches.push({ groupId: g._id, applicatorTypes: [...applicators].sort() });
        }

        for (let i = 0; i < patches.length; i += BATCH) {
            await ctx.runMutation(internal.migrations.patchApplicatorTypesBatch, {
                patches: patches.slice(i, i + BATCH),
            });
        }

        return {
            groupsUpdated: patches.length,
            message: `Populated applicatorTypes on ${patches.length} product groups.`,
        };
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
            cursor: args.cursor as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;

            const patches: { id: Id<"products">; components: unknown[] }[] = [];

            for (const p of result.page) {
                // Only process Boston Round products
                if (p.family !== "Boston Round") continue;

                const removeSet = getRemoveSet(p.capacityMl ?? null);
                if (!removeSet) { totalSkipped++; continue; }

                const original: Array<Record<string, unknown>> = Array.isArray(p.components) ? p.components as Array<Record<string, unknown>> : [];
                const filtered = original.filter((c) => {
                    const sku = (c.grace_sku as string | undefined) || (c.sku as string | undefined) || "";
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
            const result = await ctx.runQuery(internal.migrations.getProductPage, { cursor, numItems: PAGE_SIZE }) as PageResult;
            for (const p of result.page) {
                if (p.family !== "Boston Round") continue;
                const cap = p.capacity || "unknown";
                if (!byCapacity[cap]) byCapacity[cap] = { count: 0, compCounts: new Set(), issues: 0 };
                byCapacity[cap].count++;
                const comps: Array<Record<string, unknown>> = Array.isArray(p.components) ? p.components as Array<Record<string, unknown>> : [];
                byCapacity[cap].compCounts.add(comps.length);
                const badSet = cap.includes("15") ? BAD_FOR_15 : cap.includes("30") ? BAD_FOR_30 : BAD_FOR_60;
                for (const c of comps) {
                    if (badSet.has((c.grace_sku as string | undefined) || "")) byCapacity[cap].issues++;
                }
            }
            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        const summary: Record<string, { products: number; componentCounts: number[]; remainingBadComponents: number; status: string }> = {};
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
        const fixes: { id: Id<"products">; fields: Record<string, unknown>; reason: string }[] = [];

        while (!isDone) {
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;

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
// TULIP RECLASSIFICATION — Fix Cylinder/Tulip mixing
//
// Source data incorrectly classified Tulip bottles (websiteSku GBTulip*, itemName
// "Tulip design") as family "Cylinder". This caused them to appear on Cylinder PDPs.
// Reclassify to family "Tulip" so they get their own groups (tulip-5ml-amber, etc.).
//
// Run via: npx convex run migrations:fixTulipFamily
// Then re-run: node scripts/run_grouping_migration.mjs
// ─────────────────────────────────────────────────────────────────────────────

export const fixTulipFamily = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;
        const fixes: { id: Id<"products">; fields: Record<string, unknown>; reason: string }[] = [];

        while (!isDone) {
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;

            for (const p of result.page) {
                const sku = (p.websiteSku || "").toLowerCase();
                const name = (p.itemName || "").toLowerCase();

                const isTulip = sku.includes("tulip") || name.includes("tulip design");
                if (!isTulip) continue;

                if (p.family === "Tulip") continue; // already correct

                fixes.push({
                    id: p._id,
                    fields: {
                        family: "Tulip",
                        bottleCollection: "Tulip Collection",
                    },
                    reason: `${p.graceSku || p.websiteSku} → Tulip (was ${p.family ?? "null"})`,
                });
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < fixes.length; i += BATCH_SIZE) {
            const batch = fixes.slice(i, i + BATCH_SIZE).map((f) => ({
                id: f.id,
                fields: f.fields,
            }));
            await ctx.runMutation(internal.migrations.patchProductFields, { patches: batch });
        }

        return {
            totalFixed: fixes.length,
            details: fixes.map((f) => f.reason),
            message: fixes.length === 0
                ? "No Tulip products needed reclassification."
                : `Reclassified ${fixes.length} Tulip products. Run buildProductGroups + linkProductsToGroups to update groups.`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// CYLINDER 5ML DATA FIX
//
// Per DATA_QUALITY_AUDIT.md and Jordan's confirmation:
//   - Valid colors: Clear, Amber, Cobalt Blue  (thread 13-415)
//   - Remove: Black (2 SKUs), Pink (1 SKU), White (1 SKU) — 5ml doesn't come in these
//   - Remove: any 5ml Cylinder with thread 18-400 (wrong thread for this bottle)
//   - Standardize: "13mm" → "13-415" (same neck, different notation in source data)
//   - Rename: "Blue" → "Cobalt Blue" for 5ml Cylinder (BLU and CBL are the same glass;
//     BLU is just a mislabeled majority while CBL is the correct canonical name)
//
// Run BEFORE buildProductGroups so groups are built on clean data.
// Run via: npx convex run migrations:fixCylinder5mlData
// Then:    node scripts/run_grouping_migration.mjs
// ─────────────────────────────────────────────────────────────────────────────

const CYL5_WRONG_COLORS = new Set(["Black", "Pink", "White"]);

export const fixCylinder5mlData = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;

        const toDelete: { id: Id<"products">; sku: string; reason: string }[] = [];
        // Thread standardizations and Blue→Cobalt Blue renames share the same patch mechanism
        const toRename: { id: Id<"products">; sku: string; fields: Record<string, string> }[] = [];

        while (!isDone) {
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;

            for (const p of result.page) {
                // Only Cylinder 5ml bottles
                if (p.family !== "Cylinder") continue;
                if ((p.capacityMl ?? 0) !== 5) continue;

                const thread = (p.neckThreadSize ?? "").trim();
                const color = (p.color ?? "").trim();
                const skuParts = (p.graceSku || "").split("-");
                const isGbCyl = skuParts[0] === "GB" && skuParts[1] === "CYL";
                const skuColorCode = isGbCyl ? skuParts[2] : "";

                // Wrong thread: 18-400 is for larger bottles, not 5ml Cylinder
                if (thread === "18-400") {
                    toDelete.push({ id: p._id, sku: p.graceSku || "", reason: "wrong thread 18-400 for 5ml Cylinder" });
                    continue;
                }

                // Wrong colors by field value (if enrichProductFields has run)
                if (color && CYL5_WRONG_COLORS.has(color)) {
                    toDelete.push({ id: p._id, sku: p.graceSku || "", reason: `wrong color "${color}" for 5ml Cylinder` });
                    continue;
                }
                // Wrong colors by SKU segment (fallback if enrichProductFields hasn't run)
                if (isGbCyl && (skuColorCode === "BLK" || skuColorCode === "PNK" || skuColorCode === "WHT")) {
                    if (!toDelete.some(d => d.id === p._id)) {
                        toDelete.push({ id: p._id, sku: p.graceSku || "", reason: `wrong color SKU "${skuColorCode}" for 5ml Cylinder` });
                    }
                    continue;
                }

                // Collect field patches for this product (thread + color fixes)
                const fields: Record<string, string> = {};

                // Standardize "13mm" → "13-415"
                if (thread === "13mm") {
                    fields.neckThreadSize = "13-415";
                }

                // Rename "Blue" → "Cobalt Blue": BLU SKU segment and/or color field
                // Both BLU and CBL are the same cobalt glass; BLU is a source-data naming error.
                if (color === "Blue" || skuColorCode === "BLU") {
                    fields.color = "Cobalt Blue";
                }

                if (Object.keys(fields).length > 0) {
                    toRename.push({ id: p._id, sku: p.graceSku || "", fields });
                }
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        // Delete wrong-thread + wrong-color products
        const BATCH = 50;
        for (let i = 0; i < toDelete.length; i += BATCH) {
            const ids = toDelete.slice(i, i + BATCH).map(d => d.id);
            await ctx.runMutation(internal.migrations.deleteProductsBatch, { ids });
        }

        // Apply thread standardizations + Blue→Cobalt Blue renames
        for (let i = 0; i < toRename.length; i += BATCH) {
            const patches = toRename.slice(i, i + BATCH).map(r => ({
                id: r.id,
                fields: r.fields,
            }));
            await ctx.runMutation(internal.migrations.patchProductFields, { patches });
        }

        const threadFixes = toRename.filter(r => r.fields.neckThreadSize);
        const colorFixes = toRename.filter(r => r.fields.color === "Cobalt Blue");

        return {
            deleted: toDelete.length,
            threadStandardized: threadFixes.length,
            blueRenamedToCobaltBlue: colorFixes.length,
            deletedSkus: toDelete.map(d => `${d.sku} (${d.reason})`),
            renamedSkus: colorFixes.map(r => r.sku),
            message: `Removed ${toDelete.length} bad Cylinder 5ml products. Standardized ${threadFixes.length} threads "13mm"→"13-415". Renamed ${colorFixes.length} "Blue"→"Cobalt Blue". Run buildProductGroups + linkProductsToGroups to rebuild groups.`,
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
        const toDelete: { id: Id<"products">; sku: string }[] = [];

        while (!isDone) {
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;

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
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;
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

/** Insert a single product — used by addMissingVials, addMissingFineMistSprayers */
export const insertSingleProduct = internalMutation({
    args: { product: v.any() },
    handler: async (ctx, args) => {
        await ctx.db.insert("products", args.product);
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// ADD MISSING FINE MIST SPRAYER PRODUCTS
//
// 3 products from the Glass Bottles with Fine Mist Sprayers page are missing:
//   1. GBCylSwrl9SpryBlk — was incorrectly removed by remove9mlBlackWhite (BLK = sprayer trim, not black glass)
//   2. GBPillar9SpryBlkMatt — never in master seed
//   3. GBBell10SpryBlkSh — never in master seed
//
// Run via: npx convex run migrations:addMissingFineMistSprayers
// Then: node scripts/run_grouping_migration.mjs
// ─────────────────────────────────────────────────────────────────────────────

const GBCYL_SWRL_9_COMPONENTS = [
    { grace_sku: "CMP-ROC-MSLV-17415", item_name: "Matte Silver cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415MattSl.gif", price_1: 0.3, price_12: 0.29 },
    { grace_sku: "CMP-ROC-SLV-17415-DOT", item_name: "Silver with dots cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415SlDot.gif", price_1: 0.38, price_12: 0.36 },
    { grace_sku: "CMP-ROC-PNK-17415-DOT", item_name: "Pink with dots cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415PnkDot.gif", price_1: 0.38, price_12: 0.36 },
    { grace_sku: "CMP-ROC-MGLD-17415", item_name: "Matte gold cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415MattGl.gif", price_1: 0.3, price_12: 0.29 },
    { grace_sku: "CMP-ROC-SGLD-17415", item_name: "Shiny gold cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415ShnGl.gif", price_1: 0.3, price_12: 0.29 },
    { grace_sku: "CMP-ROC-SSLV-17415", item_name: "Shiny silver cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415ShnSl.gif", price_1: 0.3, price_12: 0.29 },
    { grace_sku: "CMP-ROC-CPR-17415", item_name: "Copper cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415Cu.gif", price_1: 0.3, price_12: 0.29 },
    { grace_sku: "CMP-ROC-SBLK-17415", item_name: "Shiny black cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415ShnBlk.gif", price_1: 0.3, price_12: 0.29 },
    { grace_sku: "CMP-ROC-WHT-17415", item_name: "White cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415White.gif", price_1: 0.22, price_12: 0.21 },
    { grace_sku: "CMP-ROC-BLK-17415-DOT", item_name: "Black with dots cap or closure for rollon bottles, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CpRoll17-415BlkDot.gif", price_1: 0.38, price_12: 0.36 },
    { grace_sku: "CMP-LPM-MSLV-17-415", item_name: "Matte silver collar Lotion or treatment pump, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/Ltn17-415MattSl.gif", price_1: 0.7, price_12: 0.67 },
    { grace_sku: "CMP-LPM-SGLD-17-415", item_name: "Shiny gold collar Lotion or treatment pump, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/Ltn17-415Gl.gif", price_1: 0.7, price_12: 0.67 },
    { grace_sku: "CMP-LPM-BLK-17-415", item_name: "Shiny black collar Lotion or treatment pump, Threadsize 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/Ltn17-415Blk.gif", price_1: 0.7, price_12: 0.67 },
    { grace_sku: "CMP-SPR-SGLD-17-415", item_name: "Shiny gold collar sprayer, Thread size 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/Spry17-415Gl.gif", price_1: 0.7, price_12: 0.67 },
    { grace_sku: "CMP-SPR-SLV-17-415", item_name: "Matte silver collar sprayer, Thread size 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/Spry17-415MattSl.gif", price_1: 0.7, price_12: 0.67 },
    { grace_sku: "CMP-SPR-SSLV-17-415", item_name: "Shiny silver collar sprayer, Thread size 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/Spry17-415ShnSl.gif", price_1: 0.7, price_12: 0.67 },
    { grace_sku: "CMP-SPR-BLK-17-415-01", item_name: "Shiny black collar sprayer, Thread size 17-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/Spry17-415Blk.gif", price_1: 0.7, price_12: 0.67 },
];

export const addMissingFineMistSprayers = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 200;
        let cursor: string | null = null;
        let isDone = false;
        const existingSkus = new Set<string>();

        while (!isDone) {
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;
            for (const p of result.page) {
                existingSkus.add((p.websiteSku || "").toLowerCase());
            }
            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        const newProducts = [
            {
                productId: "BB-GB-009-0127",
                websiteSku: "GBCylSwrl9SpryBlk",
                graceSku: "GB-CYL-BLK-9ML-SPR-BLK",
                category: "Glass Bottle",
                family: "Cylinder",
                shape: "Cylinder",
                color: "Swirl",
                capacity: "9 ml (0.3 oz)",
                capacityMl: 9,
                capacityOz: 0.3,
                applicator: "Fine Mist Sprayer",
                capColor: "Black",
                trimColor: "Black",
                capStyle: null,
                neckThreadSize: "17-415",
                heightWithCap: null,
                heightWithoutCap: null,
                diameter: null,
                bottleWeightG: null,
                caseQuantity: null,
                qbPrice: null,
                webPrice1pc: 1.0,
                webPrice10pc: null,
                webPrice12pc: 0.95,
                stockStatus: "In Stock",
                itemName: "Cylinder swirl design 9ml,1/3 oz glass bottle with fine mist sprayer with black trim and plastic overcap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Price each",
                itemDescription: "Cylinder swirl design 9ml,1/3 oz glass bottle with fine mist sprayer with black trim and plastic overcap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Price each",
                imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBCylSwrl9SpryBlk.gif",
                productUrl: "https://www.bestbottles.com/product/cylinder-design-9-ml-swirl-glass-bottle-sprayer-black-trim-and-cap",
                dataGrade: "A",
                bottleCollection: "Cylinder Collection",
                fitmentStatus: "verified",
                components: GBCYL_SWRL_9_COMPONENTS,
                graceDescription: "9ml Swirl glass cylinder with fine mist sprayer. Thread 17-415.",
                verified: true,
                importSource: "addMissingFineMistSprayers_2026-02-26",
            },
            {
                productId: null,
                websiteSku: "GBPillar9SpryBlkMatt",
                graceSku: "GB-PIL-CLR-9ML-SPR-MBLK",
                category: "Glass Bottle",
                family: "Pillar",
                shape: "Pillar",
                color: "Clear",
                capacity: "9 ml (0.3 oz)",
                capacityMl: 9,
                capacityOz: 0.3,
                applicator: "Fine Mist Sprayer",
                capColor: "Matte Black",
                trimColor: "Matte Black",
                capStyle: null,
                neckThreadSize: "17-415",
                heightWithCap: null,
                heightWithoutCap: null,
                diameter: null,
                bottleWeightG: null,
                caseQuantity: null,
                qbPrice: null,
                webPrice1pc: 0.97,
                webPrice10pc: null,
                webPrice12pc: 0.92,
                stockStatus: "In Stock",
                itemName: "Pillar design 9ml Clear glass bottle with matte black spray. Fine mist sprayer for use with perfumes and colognes. Refillable, classic style bottle good for promotions and decants. Price each",
                itemDescription: "Pillar design 9ml Clear glass bottle with matte black spray. Fine mist sprayer for use with perfumes and colognes. Refillable, classic style bottle good for promotions and decants. Price each",
                imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBPillar9SpryBlkMatt.gif",
                productUrl: "https://www.bestbottles.com/product/pillar-design-9-ml-clear-glass-bottle-matte-black-spray",
                dataGrade: "B",
                bottleCollection: "Pillar Collection",
                fitmentStatus: "verified",
                components: GBCYL_SWRL_9_COMPONENTS,
                graceDescription: "9ml Clear Pillar bottle with matte black spray. Thread 17-415.",
                verified: true,
                importSource: "addMissingFineMistSprayers_2026-02-26",
            },
            {
                productId: null,
                websiteSku: "GBBell10SpryBlkSh",
                graceSku: "GB-BEL-CLR-10ML-SPR-SBLK",
                category: "Glass Bottle",
                family: "Bell",
                shape: "Bell",
                color: "Clear",
                capacity: "10 ml (0.34 oz)",
                capacityMl: 10,
                capacityOz: 0.34,
                applicator: "Fine Mist Sprayer",
                capColor: "Shiny Black",
                trimColor: "Shiny Black",
                capStyle: null,
                neckThreadSize: "13-415",
                heightWithCap: null,
                heightWithoutCap: null,
                diameter: null,
                bottleWeightG: null,
                caseQuantity: null,
                qbPrice: null,
                webPrice1pc: 0.9,
                webPrice10pc: null,
                webPrice12pc: 0.86,
                stockStatus: "In Stock",
                itemName: "Bell design 10ml Clear glass bottle with shiny black spray. Fine mist sprayer for use with perfumes and colognes. Refillable, classic style bottle good for promotions and decants. Price each",
                itemDescription: "Bell design 10ml Clear glass bottle with shiny black spray. Fine mist sprayer for use with perfumes and colognes. Refillable, classic style bottle good for promotions and decants. Price each",
                imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBBell10SpryBlkSh.gif",
                productUrl: "https://www.bestbottles.com/product/bell-design-10-ml-clear-glass-bottle-shiny-black-spray",
                dataGrade: "B",
                bottleCollection: "Bell Collection",
                fitmentStatus: "verified",
                components: [],
                graceDescription: "10ml Clear Bell bottle with shiny black spray. Thread 13-415.",
                verified: true,
                importSource: "addMissingFineMistSprayers_2026-02-26",
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
            message: `Added ${added.length} products. ${skipped.length > 0 ? `Skipped ${skipped.length} (already exist).` : ""} Run buildProductGroups + linkProductsToGroups to update groups.`,
        };
    },
});

export const checkMigrationStatus = action({
    args: {},
    handler: async (ctx) => {
        const groups = (await ctx.runQuery(internal.migrations.getAllGroups, {})) as GroupRecord[];

        let total = 0;
        let linked = 0;
        let cursor: string | null = null;
        let isDone = false;

        while (!isDone) {
            const result = await ctx.runQuery(internal.migrations.countProductPage, {
                cursor,
                numItems: 100,
            }) as { count: number; linked: number; isDone: boolean; continueCursor: string };
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
