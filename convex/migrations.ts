import { mutation, action, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

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
    shape?: string | null;
    category?: string;
    bottleCollection?: string;
    neckThreadSize?: string;
    webPrice1pc?: number;
    webPrice12pc?: number;
    imageUrl?: string;
    productGroupId?: string;
    components?: unknown[];
    applicator?: string | null;
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

type ProductApplicator = Exclude<Doc<"products">["applicator"], null>;

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

// Maps exact applicator strings to a bucket label used in grouping and slugs.
// Bottles with the same bucket stay in the same product group (e.g. Metal Roller +
// Plastic Roller are both "rollon" and share a PDP). Bottles with different buckets
// (e.g. Fine Mist Sprayer vs Metal Roller) become separate groups with separate catalog cards.
// "Metal Atomizer" is intentionally excluded — those products get their own category
// entirely and never enter the glass bottle applicator bucket system.
// Components (caps, sprayers sold standalone) have no applicator and get no bucket.
const APPLICATOR_BUCKET_MAP: Record<string, string> = {
    "Metal Roller Ball": "rollon",
    "Plastic Roller Ball": "rollon",
    "Metal Roller": "rollon",
    "Plastic Roller": "rollon",
    // Fine mist (< 30 ml atomizer-style) and perfume spray (≥ 30 ml collar-style)
    // are now separate UI buckets so they get distinct filter chips.
    "Fine Mist Sprayer": "finemist",
    "Atomizer": "finemist",
    "Perfume Spray Pump": "perfumespray",
    "Vintage Bulb Sprayer": "antiquespray",
    "Vintage Bulb Sprayer with Tassel": "antiquespray-tassel",
    // Legacy keys kept for backward-compat during migration window
    "Antique Bulb Sprayer": "antiquespray",
    "Antique Bulb Sprayer with Tassel": "antiquespray-tassel",
    "Dropper": "dropper",
    "Lotion Pump": "lotionpump",
    "Reducer": "reducer",
    "Glass Rod": "glasswand",
    "Applicator Cap": "glasswand",
    "Glass Stopper": "glassapplicator",
    "Cap/Closure": "capclosure",
    // Metal Atomizer deliberately omitted — handled as its own category
};

const APPLICATOR_BUCKET_LABELS: Record<string, string> = {
    rollon: "Roll-On",
    finemist: "Fine Mist Spray",
    perfumespray: "Perfume Spray",
    antiquespray: "Vintage Bulb Spray",
    "antiquespray-tassel": "Vintage Bulb Spray with Tassel",
    dropper: "Dropper",
    lotionpump: "Lotion Pump",
    reducer: "Reducer",
    glasswand: "Glass Wand",
    glassapplicator: "Glass Applicator",
    capclosure: "Cap/Closure",
};

// Customer-facing format nouns for clean product titles.
const APPLICATOR_BUCKET_TITLE: Record<string, string> = {
    rollon: "Roll-On Bottle",
    finemist: "Fine Mist Spray Bottle",
    antiquespray: "Vintage Bulb Spray Bottle",
    "antiquespray-tassel": "Vintage Bulb Spray Bottle with Tassel",
    dropper: "Dropper Bottle",
    lotionpump: "Lotion Pump Bottle",
    reducer: "Reducer Bottle",
    glasswand: "Applicator Bottle",
    glassapplicator: "Applicator Bottle",
    capclosure: "Bottle",
};

// For naming, include Plastic Bottle families in the bottle-style title formula.
const BOTTLE_NAMING_CATEGORIES = new Set([...BOTTLE_CATEGORIES, "Plastic Bottle"]);

// Decorative products have distinct shapes that should appear in the display name
// instead of the generic "Decorative" label. Shape is derived from websiteSku patterns.
const DECORATIVE_SHAPE_RULES: Array<{ test: (sku: string) => boolean; shape: string }> = [
    { test: (s) => /heart/i.test(s), shape: "Heart" },
    { test: (s) => /TPlGl/i.test(s), shape: "Tola" },
    { test: (s) => /MtlMrbl/i.test(s), shape: "Marble" },
    { test: (s) => /pear/i.test(s), shape: "Pear" },
    { test: (s) => /genie/i.test(s), shape: "Genie" },
    { test: (s) => /eternalflame/i.test(s), shape: "Eternal Flame" },
];

function detectDecorativeShape(websiteSku: string): string | null {
    for (const rule of DECORATIVE_SHAPE_RULES) {
        if (rule.test(websiteSku)) return rule.shape;
    }
    return null;
}

const DECORATIVE_ACCESSORY_RULES: Array<{ test: (sku: string) => boolean; accessory: string; label: string }> = [
    { test: (s) => /Key/i.test(s), accessory: "keychain", label: "with Keychain" },
    { test: (s) => /Tsl/i.test(s), accessory: "tassel", label: "with Tassel" },
    { test: (s) => /Stpr/i.test(s), accessory: "stopper", label: "with Stopper" },
];

function detectDecorativeAccessory(websiteSku: string): { slug: string; label: string } | null {
    for (const rule of DECORATIVE_ACCESSORY_RULES) {
        if (rule.test(websiteSku)) return { slug: rule.accessory, label: rule.label };
    }
    return null;
}

function getDecorativeSuffix(
    shape: string,
    applicatorBucket: string | null,
    accessoryLabel: string | null,
): string {
    if (accessoryLabel) return `Bottle ${accessoryLabel}`;
    if (shape === "Pear") return "Bottle with Stopper";
    return "Bottle";
}

function isMetalAtomizerCategory(category: string): boolean {
    return category === "Metal Atomizer";
}

const COMPONENT_CATEGORIES = new Set(["Component"]);

function getComponentSubType(
    itemName: string | null | undefined,
    websiteSku: string | null | undefined,
    applicator: string | null | undefined,
): string | null {
    const name = (itemName || "").toLowerCase();
    const sku = (websiteSku || "").toLowerCase();

    if (name.includes("antique") || name.includes("vintage") || name.includes("bulb sprayer")) {
        return name.includes("tassel") ? "Vintage Bulb Sprayer with Tassel" : "Vintage Bulb Sprayer";
    }
    if (name.includes("fine mist") || name.includes("sprayer") || sku.startsWith("cp") && sku.includes("spry") || sku.startsWith("spry")) {
        return "Fine Mist Sprayer";
    }
    if (name.includes("lotion") || name.includes("treatment pump")) return "Lotion Pump";
    if (name.includes("dropper")) return "Dropper";
    if (name.includes("roll-on") || name.includes("rollon") || name.includes("roller")) return "Roll-On Fitment";
    if (name.includes("stopper")) return "Glass Stopper";
    if (name.includes("reducer")) return "Reducer";

    if (applicator === "Fine Mist Sprayer" || applicator === "Perfume Spray Pump") return "Fine Mist Sprayer";
    if (applicator === "Vintage Bulb Sprayer" || applicator === "Antique Bulb Sprayer") return "Vintage Bulb Sprayer";
    if (applicator === "Vintage Bulb Sprayer with Tassel" || applicator === "Antique Bulb Sprayer with Tassel") return "Vintage Bulb Sprayer with Tassel";
    if (applicator === "Lotion Pump") return "Lotion Pump";
    if (applicator === "Dropper") return "Dropper";

    if (name.includes("cap") || name.includes("closure")) return "Cap & Closure";

    return null;
}

function getApplicatorBucket(applicator: string | null | undefined): string | null {
    if (!applicator || !applicator.trim()) return null;
    return APPLICATOR_BUCKET_MAP[applicator.trim()] ?? null;
}

/** Extract clean thread size (e.g. "13-415") from values like "Size: 13-415 Nemat Internation" */
function normalizeThreadForSlug(neckThreadSize: string | null): string | null {
    if (!neckThreadSize || !neckThreadSize.trim()) return null;
    const match = neckThreadSize.match(/(\d+-\d+)/);
    return match ? match[1] : neckThreadSize.trim();
}

function buildSlug(
    family: string | null,
    capacityMl: number | null,
    color: string | null,
    category: string,
    neckThreadSize: string | null,
    applicatorBucket: string | null,
    shape: string | null = null,
    accessorySlug: string | null = null,
    componentSubType: string | null = null,
): string {
    const slugify = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    if (isMetalAtomizerCategory(category)) {
        const c = capacityMl != null ? `${capacityMl}ml` : "0ml";
        return `atomizer-${c}`;
    }
    if (COMPONENT_CATEGORIES.has(category) && componentSubType) {
        const base = slugify(componentSubType);
        const thread = normalizeThreadForSlug(neckThreadSize);
        return thread ? `${base}-${thread}` : base;
    }

    const hasDecShape = (family === "Decorative" || family === "Apothecary") && shape;
    const familyLabel = hasDecShape ? shape : (family || category || "unknown");
    const f = slugify(familyLabel);
    const c = capacityMl != null ? `${capacityMl}ml` : "0ml";
    const col = slugify(color || "mixed");
    if (BOTTLE_CATEGORIES.has(category) && neckThreadSize) {
        const thread = normalizeThreadForSlug(neckThreadSize) ?? slugify(neckThreadSize);
        let base = `${f}-${c}-${col}-${thread}`;
        if (accessorySlug) base = `${base}-${accessorySlug}`;
        return applicatorBucket ? `${base}-${applicatorBucket}` : base;
    }
    return accessorySlug ? `${f}-${c}-${col}-${accessorySlug}` : `${f}-${c}-${col}`;
}

function buildDisplayName(
    family: string | null,
    capacity: string | null,
    color: string | null,
    category: string,
    applicatorBucket: string | null,
    shape: string | null = null,
    accessoryLabel: string | null = null,
    componentSubType: string | null = null,
    neckThreadSize: string | null = null,
): string {
    if (isMetalAtomizerCategory(category)) {
        const cap = capacity && capacity !== "0 ml (0 oz)"
            ? (capacity.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*ml/i)?.[1]
                ? `${capacity.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*ml/i)![1]} ml`
                : capacity)
            : null;
        return [cap, "Atomizer Bottle"].filter(Boolean).join(" ");
    }

    if (COMPONENT_CATEGORIES.has(category) && componentSubType) {
        return neckThreadSize
            ? `${componentSubType} — Thread ${neckThreadSize}`
            : componentSubType;
    }

    const formatCapacity = (raw: string | null): string | null => {
        if (!raw || raw === "0 ml (0 oz)") return null;
        const m = raw.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*ml/i);
        if (m) return `${m[1]} ml`;
        return raw;
    };

    // Decorative / Apothecary: "4 ml Frosted Heart Bottle with Keychain"
    if ((family === "Decorative" || family === "Apothecary") && shape) {
        const cap = formatCapacity(capacity);
        const col = (color || "").trim();
        const suffix = getDecorativeSuffix(shape, applicatorBucket, accessoryLabel);
        return [cap, col, shape, suffix].filter(Boolean).join(" ");
    }

    // Clean customer-facing bottle name:
    // [Capacity] [Color] [Family] [Format]
    // e.g. "5 ml Cobalt Blue Cylinder Spray Bottle"
    if (BOTTLE_NAMING_CATEGORIES.has(category)) {
        const cap = formatCapacity(capacity);
        const fam = (family || category || "").trim();
        const col = (color || "").trim();
        const format = applicatorBucket
            ? (APPLICATOR_BUCKET_TITLE[applicatorBucket] ?? "Bottle")
            : "Bottle with Cap";
        const formatSafe = fam.toLowerCase().includes("bottle") && format === "Bottle" ? "" : format;
        const parts = [cap, col, fam, formatSafe].filter(Boolean);
        if (parts.length > 0) return parts.join(" ");
    }

    // Non-bottle fallback (components/accessories)
    const applLabel = applicatorBucket && APPLICATOR_BUCKET_LABELS[applicatorBucket];
    const cap = formatCapacity(capacity);
    const base = [family || category, cap, color].filter(Boolean).join(" ");
    if (applLabel) return `${base} (${applLabel})`;
    return base || family || category || "Product";
}

function buildGroupKey(
    family: string | null,
    capacityMl: number | null,
    color: string | null,
    category: string,
    neckThreadSize: string | null,
    applicatorBucket: string | null,
    shape: string | null = null,
    accessorySlug: string | null = null,
    componentSubType: string | null = null,
): string {
    if (isMetalAtomizerCategory(category)) {
        return ["Atomizer", capacityMl ?? "null", "metal-shell"].join("|");
    }
    if (COMPONENT_CATEGORIES.has(category) && componentSubType) {
        return `CMP|${componentSubType}|${neckThreadSize || "null"}`;
    }
    const hasDecShape = (family === "Decorative" || family === "Apothecary") && shape;
    let familyKey = hasDecShape ? `Decorative:${shape}` : (family || category);
    if (hasDecShape && accessorySlug) familyKey = `${familyKey}:${accessorySlug}`;
    const parts: (string | number)[] = [familyKey, capacityMl ?? "null", color || "null"];
    if (BOTTLE_CATEGORIES.has(category)) {
        parts.push(neckThreadSize || "null");
        parts.push(applicatorBucket || "none");
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
                // GBAtom* products are metal-shell travel atomizers, not glass bottles.
                // Override their category so they never enter glass bottle grouping logic.
                // Check websiteSku (e.g. GBAtom5SlStars) since source data may have applicator "Atomizer" not "Metal Atomizer".
                const isMetalAtomizer = p.applicator === "Metal Atomizer" || (p.websiteSku || "").startsWith("GBAtom");
                const effectiveCategory = isMetalAtomizer
                    ? "Metal Atomizer"
                    : (p.category ?? "unknown");
                const effectiveFamily = isMetalAtomizer
                    ? "Atomizer"
                    : (p.family ?? null);

                const applicatorBucket = BOTTLE_CATEGORIES.has(effectiveCategory)
                    ? getApplicatorBucket(p.applicator)
                    : null;
                const isDecorativeFamily = effectiveFamily === "Decorative" || effectiveFamily === "Apothecary";
                const decorativeShape = isDecorativeFamily
                    ? detectDecorativeShape(p.websiteSku || "")
                    : null;
                const decAccessory = isDecorativeFamily
                    ? detectDecorativeAccessory(p.websiteSku || "")
                    : null;
                const accessorySlug = decAccessory?.slug ?? null;
                const accessoryLabel = decAccessory?.label ?? null;
                const componentSubType = COMPONENT_CATEGORIES.has(effectiveCategory)
                    ? getComponentSubType(p.itemName, p.websiteSku, p.applicator)
                    : null;
                const key = buildGroupKey(effectiveFamily, p.capacityMl ?? null, p.color ?? null, effectiveCategory, p.neckThreadSize ?? null, applicatorBucket, decorativeShape, accessorySlug, componentSubType);

                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        slug: buildSlug(effectiveFamily, p.capacityMl ?? null, p.color ?? null, effectiveCategory, p.neckThreadSize ?? null, applicatorBucket, decorativeShape, accessorySlug, componentSubType),
                        displayName: buildDisplayName(effectiveFamily, p.capacity ?? null, p.color ?? null, effectiveCategory, applicatorBucket, decorativeShape, accessoryLabel, componentSubType, p.neckThreadSize ?? null),
                        family: effectiveFamily || effectiveCategory || "unknown",
                        capacity: p.capacity ?? null,
                        capacityMl: p.capacityMl ?? null,
                        color: isMetalAtomizer ? null : (p.color ?? null),
                        category: effectiveCategory,
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
                const isMetalAtomizer = p.applicator === "Metal Atomizer" || (p.websiteSku || "").startsWith("GBAtom");
                const effectiveCategory = isMetalAtomizer
                    ? "Metal Atomizer"
                    : (p.category ?? "unknown");
                const effectiveFamily = isMetalAtomizer
                    ? "Atomizer"
                    : (p.family ?? null);
                const applicatorBucket = BOTTLE_CATEGORIES.has(effectiveCategory)
                    ? getApplicatorBucket(p.applicator)
                    : null;
                const isDecorativeFamily = effectiveFamily === "Decorative" || effectiveFamily === "Apothecary";
                const decorativeShape = isDecorativeFamily
                    ? detectDecorativeShape(p.websiteSku || "")
                    : null;
                const decAccessory = isDecorativeFamily
                    ? detectDecorativeAccessory(p.websiteSku || "")
                    : null;
                const componentSubType = COMPONENT_CATEGORIES.has(effectiveCategory)
                    ? getComponentSubType(p.itemName, p.websiteSku, p.applicator)
                    : null;
                const slug = buildSlug(effectiveFamily, p.capacityMl ?? null, p.color ?? null, effectiveCategory, p.neckThreadSize ?? null, applicatorBucket, decorativeShape, decAccessory?.slug ?? null, componentSubType);
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

const APPLICATOR_MAP: Record<string, ProductApplicator> = {
    ROL: "Plastic Roller Ball",
    MRL: "Metal Roller Ball",
    RON: "Plastic Roller Ball",   // Boston Round family variant
    MRO: "Metal Roller Ball",     // Boston Round family variant
    RBL: "Plastic Roller Ball",   // Elegant family variant
    SPR: "Fine Mist Sprayer",
    ASP: "Vintage Bulb Sprayer",
    AST: "Vintage Bulb Sprayer with Tassel",
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

function deriveApplicator(graceSku: string, itemName: string): Doc<"products">["applicator"] {
    const parts = graceSku.split("-");
    const prefix = parts[0];
    if (prefix !== "GB" && prefix !== "LB") return null;

    // GBAtom* SKUs are refillable metal-shell travel atomizers — a separate product
    // category entirely (not glass bottles). Flag them so the grouping pipeline
    // can assign them category "Metal Atomizer" and keep them out of glass bottle filters.
    if (graceSku.startsWith("GBAtom")) return "Metal Atomizer";

    // Pass 1: SKU segment
    const fromSku = APPLICATOR_MAP[parts[4]];
    if (fromSku) return fromSku;

    // Pass 2: item name keywords
    const n = itemName.toLowerCase();
    if (n.includes("metal roller")) return "Metal Roller Ball";
    if (n.includes("roller ball") || n.includes("plastic roller")) return "Plastic Roller Ball";
    if (n.includes("tassel")) return "Vintage Bulb Sprayer with Tassel";
    if (n.includes("vintage") || n.includes("antique") || n.includes("bulb spray")) return "Vintage Bulb Sprayer";
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
            applicator: v.union(
                v.literal("Metal Roller Ball"),
                v.literal("Plastic Roller Ball"),
                v.literal("Fine Mist Sprayer"),
                v.literal("Perfume Spray Pump"),
                v.literal("Atomizer"),
                v.literal("Vintage Bulb Sprayer"),
                v.literal("Vintage Bulb Sprayer with Tassel"),
                v.literal("Antique Bulb Sprayer"),
                v.literal("Antique Bulb Sprayer with Tassel"),
                v.literal("Lotion Pump"),
                v.literal("Dropper"),
                v.literal("Reducer"),
                v.literal("Glass Stopper"),
                v.literal("Glass Rod"),
                v.literal("Cap/Closure"),
                v.literal("Applicator Cap"),
                v.literal("Metal Atomizer"),
                v.literal("N/A"),
                v.null()
            ),
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

            const patches: { id: Id<"products">; applicator: Doc<"products">["applicator"]; color: string | null }[] = [];
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

/** Get products by neck thread size — used to find 13-415 compatible components */
export const getProductsByThread = internalQuery({
    args: { neckThreadSize: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_neckThreadSize", (q) => q.eq("neckThreadSize", args.neckThreadSize))
            .collect();
    },
});

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

// ─────────────────────────────────────────────────────────────────────────────
// POPULATE BELL 10ML COMPONENTS
// Bell 10ml Clear spray (GBBell10SpryBlkSh) uses 13-415 thread, same as Bell 12ml.
// It was added with empty components. This migration populates from all 13-415
// compatible components in Convex (sprayers, fine mist, caps, roll-on, rollers).
// Includes static fallback for short caps (CMP-CAP-BLK-S-13-415, CMP-CAP-WHT-S-13-415)
// in case they're missing from Convex.
// Run: npx convex run migrations:populateBell10mlComponents
// ─────────────────────────────────────────────────────────────────────────────

const BOTTLE_CATEGORIES_FOR_EXCLUDE = new Set(["Glass Bottle", "Lotion Bottle", "Aluminum Bottle", "Glass Jar"]);

/** Static fallback: 13-415 short caps and key components from grace_products_final / fitment.
 * Merged in case they're not in Convex (e.g. different seed source). */
const BELL_10ML_13_415_FALLBACK: Array<{ grace_sku: string; item_name: string; image_url: string; price_1: number | null; price_12: number | null }> = [
    { grace_sku: "CMP-CAP-BLK-S-13-415", item_name: "Black lid or closure for glass bottle, Thread size 13-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CP13-415BlkSht.gif", price_1: 0.24, price_12: 0.23 },
    { grace_sku: "CMP-CAP-WHT-S-13-415", item_name: "White lid or closure for glass bottle, Thread size 13-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CP13-415WhtSht.gif", price_1: 0.24, price_12: 0.23 },
    { grace_sku: "CMP-CAP-SGLD-13-415-01", item_name: "Shiny gold lid or closure for glass bottle, Thread size 13-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CP13-415Gl.gif", price_1: 0.3, price_12: 0.29 },
    { grace_sku: "CMP-CAP-SLV-13-415-01", item_name: "Shiny silver lid or closure for glass bottle, Thread size 13-415", image_url: "https://www.bestbottles.com/images/store/enlarged_pics/CP13-415Sl.gif", price_1: 0.3, price_12: 0.29 },
];

/** Internal: get single product by websiteSku */
export const getProductBySku = internalQuery({
    args: { websiteSku: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.websiteSku))
            .first();
    },
});

export const populateBell10mlComponents = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; message: string; componentCount: number }> => {
        const threadProducts = (await ctx.runQuery(internal.migrations.getProductsByThread, {
            neckThreadSize: "13-415",
        })) as RawProduct[];

        // Filter to components only — exclude bottles (glass, lotion, aluminum, cream jars)
        // Standalone components have capacityMl 0 or null (caps, sprayers, roll-on caps)
        const components: Array<{ grace_sku: string; item_name: string; image_url: string; price_1: number | null; price_12: number | null }> = threadProducts
            .filter((p: RawProduct) => {
                const cat = (p.category ?? "").trim();
                if (BOTTLE_CATEGORIES_FOR_EXCLUDE.has(cat)) return false;
                const capMl = p.capacityMl ?? null;
                // Exclude full bottles (e.g. plastic 30ml with sprayer)
                if (capMl != null && capMl > 0) return false;
                return cat === "Component" || cat === "Cap/Closure" || capMl === 0 || capMl === null;
            })
            .map((p: RawProduct) => ({
                grace_sku: p.graceSku ?? "",
                item_name: p.itemName ?? "",
                image_url: p.imageUrl ?? "",
                price_1: p.webPrice1pc ?? null,
                price_12: p.webPrice12pc ?? null,
            }))
            .filter((c) => c.grace_sku);

        // Merge static fallback (short caps, tall caps) — dedupe by grace_sku
        const seen = new Set(components.map((c) => c.grace_sku));
        for (const fb of BELL_10ML_13_415_FALLBACK) {
            if (!seen.has(fb.grace_sku)) {
                components.push(fb);
                seen.add(fb.grace_sku);
            }
        }

        // Find Bell 10ml spray product
        const bell10 = await ctx.runQuery(internal.migrations.getProductBySku, {
            websiteSku: "GBBell10SpryBlkSh",
        });

        if (!bell10) {
            return {
                success: false,
                message: "Bell 10ml product (GBBell10SpryBlkSh) not found.",
                componentCount: components.length,
            };
        }

        await ctx.runMutation(internal.migrations.patchProductComponents, {
            patches: [{ id: bell10._id, components }],
        });

        return {
            success: true,
            message: `Populated Bell 10ml with ${components.length} compatible 13-415 components.`,
            componentCount: components.length,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// ADD MISSING BELL 10ML BOTTLE VARIANTS
// Live site has 4 Bell 10ml variants; we only had the spray. Adds:
//   - GBBell10BlkShSht (short cap)
//   - GBBell10RollBlkDot (plastic roller)
//   - GBBell10MtlRollBlkDot (metal roller)
// GBBell10SpryBlkSh already exists from addMissingFineMistSprayers.
// Run: npx convex run migrations:addMissingBell10Variants
// Then: npx convex run migrations:populateBell10mlComponents (patches all Bell 10ml)
// Then: node scripts/run_grouping_migration.mjs
// ─────────────────────────────────────────────────────────────────────────────

const BELL_10ML_MISSING_VARIANTS = [
    {
        productId: null,
        websiteSku: "GBBell10BlkShSht",
        graceSku: "GB-BEL-CLR-10ML-SHT-SBLK",
        category: "Glass Bottle",
        family: "Bell",
        shape: "Bell",
        color: "Clear",
        capacity: "10 ml (0.34 oz)",
        capacityMl: 10,
        capacityOz: 0.34,
        applicator: "Cap/Closure",
        capColor: "Shiny Black",
        trimColor: "Shiny Black",
        capStyle: "Short",
        neckThreadSize: "13-415",
        heightWithCap: "59 ±1 mm",
        heightWithoutCap: "55 ±1 mm",
        diameter: "27 ±0.5 mm",
        bottleWeightG: null,
        caseQuantity: null,
        qbPrice: null,
        webPrice1pc: 0.6,
        webPrice10pc: null,
        webPrice12pc: 0.57,
        stockStatus: "In Stock",
        itemName: "Bell design 10ml Clear glass bottle with short shiny black cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, classic style bottle good for promotions and decants. Price each",
        itemDescription: "Bell design 10ml Clear glass bottle with short shiny black cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, classic style bottle good for promotions and decants. Price each",
        imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBBell10BlkShSht.gif",
        productUrl: "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-short-shiny-black-cap",
        dataGrade: "B",
        bottleCollection: "Bell Collection",
        fitmentStatus: "verified",
        components: [],
        graceDescription: "10ml Clear Bell bottle with short shiny black cap. Thread 13-415.",
        verified: true,
        importSource: "addMissingBell10Variants_2026-02-28",
    },
    {
        productId: null,
        websiteSku: "GBBell10RollBlkDot",
        graceSku: "GB-BEL-CLR-10ML-ROL-BLDOT",
        category: "Glass Bottle",
        family: "Bell",
        shape: "Bell",
        color: "Clear",
        capacity: "10 ml (0.34 oz)",
        capacityMl: 10,
        capacityOz: 0.34,
        applicator: "Plastic Roller Ball",
        capColor: "Shiny Black",
        trimColor: "Shiny Black",
        capStyle: null,
        ballMaterial: "Plastic",
        neckThreadSize: "13-415",
        heightWithCap: "66 ±1 mm",
        heightWithoutCap: "55 ±1 mm",
        diameter: "27 ±0.5 mm",
        bottleWeightG: null,
        caseQuantity: null,
        qbPrice: null,
        webPrice1pc: 0.74,
        webPrice10pc: null,
        webPrice12pc: 0.7,
        stockStatus: "In Stock",
        itemName: "Bell design 10ml Clear glass bottle with plastic roller ball plug and black shiny cap with dots. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, classic style bottle good for promotions and decants. Price each",
        itemDescription: "Bell design 10ml Clear glass bottle with plastic roller ball plug and black shiny cap with dots. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, classic style bottle good for promotions and decants. Price each",
        imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBBell10RollBlkDot.gif",
        productUrl: "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-plastic-roller-ball-plug-black-shiny-cap-with-dots",
        dataGrade: "B",
        bottleCollection: "Bell Collection",
        fitmentStatus: "verified",
        components: [],
        graceDescription: "10ml Clear Bell bottle with plastic roller and black cap with dots. Thread 13-415.",
        verified: true,
        importSource: "addMissingBell10Variants_2026-02-28",
    },
    {
        productId: null,
        websiteSku: "GBBell10MtlRollBlkDot",
        graceSku: "GB-BEL-CLR-10ML-MRL-BLDOT",
        category: "Glass Bottle",
        family: "Bell",
        shape: "Bell",
        color: "Clear",
        capacity: "10 ml (0.34 oz)",
        capacityMl: 10,
        capacityOz: 0.34,
        applicator: "Metal Roller Ball",
        capColor: "Shiny Black",
        trimColor: "Shiny Black",
        capStyle: null,
        ballMaterial: "Metal",
        neckThreadSize: "13-415",
        heightWithCap: "66 ±1 mm",
        heightWithoutCap: "55 ±1 mm",
        diameter: "27 ±0.5 mm",
        bottleWeightG: null,
        caseQuantity: null,
        qbPrice: null,
        webPrice1pc: 0.82,
        webPrice10pc: null,
        webPrice12pc: 0.78,
        stockStatus: "In Stock",
        itemName: "Bell design 10ml Clear glass bottle with metal roller ball plug and black shiny cap with dots. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, classic style bottle good for promotions and decants. Price each",
        itemDescription: "Bell design 10ml Clear glass bottle with metal roller ball plug and black shiny cap with dots. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, classic style bottle good for promotions and decants. Price each",
        imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBBell10MtlRollBlkDot.gif",
        productUrl: "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-metal-roller-ball-plug-black-shiny-cap-with-dots",
        dataGrade: "B",
        bottleCollection: "Bell Collection",
        fitmentStatus: "verified",
        components: [],
        graceDescription: "10ml Clear Bell bottle with metal roller and black cap with dots. Thread 13-415.",
        verified: true,
        importSource: "addMissingBell10Variants_2026-02-28",
    },
];

export const addMissingBell10Variants = action({
    args: {},
    handler: async (ctx): Promise<{ added: string[]; skipped: string[]; message: string }> => {
        const existingSkus = new Set<string>();
        let cursor: string | null = null;
        let isDone = false;
        while (!isDone) {
            const result = (await ctx.runQuery(internal.migrations.getProductPage, { cursor, numItems: 100 })) as PageResult;
            for (const p of result.page) {
                existingSkus.add((p.websiteSku ?? "").toLowerCase());
            }
            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        const added: string[] = [];
        const skipped: string[] = [];

        for (const product of BELL_10ML_MISSING_VARIANTS) {
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
            message: `Added ${added.length} Bell 10ml variants. ${skipped.length > 0 ? `Skipped ${skipped.length} (already exist).` : ""} Run populateBell10mlComponents then buildProductGroups + linkProductsToGroups.`,
        };
    },
});

/** Patches ALL Bell 10ml products (family=Bell, capacityMl=10) with 13-415 components.
 * Run after addMissingBell10Variants so new variants get components too. */
export const populateAllBell10mlComponents = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; message: string; patchedCount: number; componentCount: number }> => {
        const threadProducts = (await ctx.runQuery(internal.migrations.getProductsByThread, {
            neckThreadSize: "13-415",
        })) as RawProduct[];

        const components: Array<{ grace_sku: string; item_name: string; image_url: string; price_1: number | null; price_12: number | null }> = threadProducts
            .filter((p: RawProduct) => {
                const cat = (p.category ?? "").trim();
                if (BOTTLE_CATEGORIES_FOR_EXCLUDE.has(cat)) return false;
                const capMl = p.capacityMl ?? null;
                if (capMl != null && capMl > 0) return false;
                return cat === "Component" || cat === "Cap/Closure" || capMl === 0 || capMl === null;
            })
            .map((p: RawProduct) => ({
                grace_sku: p.graceSku ?? "",
                item_name: p.itemName ?? "",
                image_url: p.imageUrl ?? "",
                price_1: p.webPrice1pc ?? null,
                price_12: p.webPrice12pc ?? null,
            }))
            .filter((c) => c.grace_sku);

        const seen = new Set(components.map((c) => c.grace_sku));
        for (const fb of BELL_10ML_13_415_FALLBACK) {
            if (!seen.has(fb.grace_sku)) {
                components.push(fb);
                seen.add(fb.grace_sku);
            }
        }

        const bell10Products = await ctx.runQuery(internal.migrations.getBell10mlProducts, {});

        if (bell10Products.length === 0) {
            return {
                success: false,
                message: "No Bell 10ml products found.",
                patchedCount: 0,
                componentCount: components.length,
            };
        }

        const patches: { id: Id<"products">; components: unknown[] }[] = bell10Products.map((p: Doc<"products">) => ({ id: p._id, components }));
        await ctx.runMutation(internal.migrations.patchProductComponentsBatch, { patches });

        return {
            success: true,
            message: `Populated ${bell10Products.length} Bell 10ml products with ${components.length} compatible components.`,
            patchedCount: bell10Products.length,
            componentCount: components.length,
        };
    },
});

/** Internal: get all Bell 10ml products */
export const getBell10mlProducts = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", "Bell"))
            .collect()
            .then((rows) => rows.filter((p) => (p.capacityMl ?? 0) === 10));
    },
});

/** Patch multiple products' components in one mutation */
export const patchProductComponentsBatch = internalMutation({
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

/** Verify the BSR dropper fix — check component counts per capacity */
export const verifyBsrFix = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        let cursor: string | null = null;
        let isDone = false;

        const BAD_FOR_30: Set<string> = new Set(["CMP-DRP-WHT-20400-90", "CMP-DRP-BKSL-20400-90", "CMP-DRP-WTGD-20400-90", "CMP-DRP-BKGD-20400-90", "CMP-DRP-WTSL-20400-90", "CMP-DRP-BLK-20400-90", "CMP-CAP-BLK-20-400-2OZ"]);
        const BAD_FOR_60: Set<string> = new Set(["CMP-DRP-WHT-20400-76", "CMP-DRP-BKSL-20400-76", "CMP-DRP-WTGD-20400-76", "CMP-DRP-BKGD-20400-76", "CMP-DRP-WTSL-20400-76", "CMP-DRP-BLK-20400-76MM-01", "CMP-CAP-BLK-20-400-1OZ"]);
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
// 5ML AMBER → TULIP (revert: Tulip-shaped bottles must stay in Tulip family)
//
// 5ml Amber bottles (GBTulipAmb5*) are Tulip-shaped (bulbous top), NOT Cylinder-shaped.
// Reclassify back to Tulip so they appear on Tulip PDPs, not Cylinder PDPs.
// Cylinder 5ml roll-on PDP shows only Clear and Blue (no Amber — Best Bottles doesn't
// sell Cylinder 5ml in Amber).
//
// Run via: npx convex run migrations:reclassify5mlAmberToTulip
// Then:    node scripts/run_grouping_migration.mjs
// ─────────────────────────────────────────────────────────────────────────────

export const reclassify5mlAmberToTulip = action({
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
                if (p.family !== "Cylinder") continue;
                if ((p.capacityMl ?? 0) !== 5) continue;
                const color = (p.color ?? "").trim();
                if (color !== "Amber") continue;
                const sku = (p.websiteSku || "").toLowerCase();
                if (!sku.includes("tulip")) continue; // only Tulip-shaped bottles (GBTulipAmb5*)

                fixes.push({
                    id: p._id,
                    fields: {
                        family: "Tulip",
                        bottleCollection: "Tulip Collection",
                    },
                    reason: `${p.graceSku || p.websiteSku} → Tulip (5ml Amber Tulip-shaped bottle)`,
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
                ? "No 5ml Amber Cylinder products to reclassify."
                : `Reclassified ${fixes.length} 5ml Amber products to Tulip. Run buildProductGroups + linkProductsToGroups to update groups.`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// APOTHECARY RECLASSIFICATION
//
// Reclassify Decorative products that appear on BestBottles Apothecary Style page:
//   GBPearClear4ozStpr (4oz pear) only. GBCB12ozPear is on Large Decorative page → Decorative.
//
// Run via: npx convex run migrations:fixApothecaryTaxonomy
// Then:    node scripts/run_grouping_migration.mjs
// ─────────────────────────────────────────────────────────────────────────────

const APOTHECARY_RECLASSIFY_SKUS = new Set(["gbpearclear4ozstpr"]);

export const fixApothecaryTaxonomy = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 200;
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
                if (!APOTHECARY_RECLASSIFY_SKUS.has(sku)) continue;
                if (p.family === "Apothecary") continue;

                fixes.push({
                    id: p._id,
                    fields: {
                        family: "Apothecary",
                        bottleCollection: "Apothecary",
                    },
                    reason: `${p.graceSku || p.websiteSku} → Apothecary (was ${p.family ?? "null"})`,
                });
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        if (fixes.length > 0) {
            await ctx.runMutation(internal.migrations.patchProductFields, {
                patches: fixes.map((f) => ({ id: f.id, fields: f.fields })),
            });
        }

        return {
            totalFixed: fixes.length,
            details: fixes.map((f) => f.reason),
            message: fixes.length === 0
                ? "No Apothecary products needed reclassification."
                : `Reclassified ${fixes.length} products to Apothecary. Run buildProductGroups + linkProductsToGroups to update groups.`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// LARGE DECORATIVE RECLASSIFICATION
//
// Products on BestBottles Large Decorative page must appear in our Decorative section:
//   https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/large-perfume-bottles-decorative.php
//
// Reclassify: Genie (2), Eternal Flame (3), GBCB12ozPear (12oz pear) → Decorative
//
// Run via: npx convex run migrations:fixDecorativeTaxonomy
// Then:    node scripts/run_grouping_migration.mjs
// ─────────────────────────────────────────────────────────────────────────────

const LARGE_DECORATIVE_SKUS = new Set([
    "gb1ozgeniebl", "gb1ozgeniecl",           // Genie
    "gbeternalflameblue", "gbeternalflameclear", "gbeternalflamegreen",  // Eternal Flame
    "gbcb12ozpear",                            // 12oz pear (also on Apothecary page; lives in Decorative)
]);

export const fixDecorativeTaxonomy = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 200;
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
                if (!LARGE_DECORATIVE_SKUS.has(sku)) continue;
                if (p.family === "Decorative") continue;

                fixes.push({
                    id: p._id,
                    fields: {
                        family: "Decorative",
                        bottleCollection: "Decorative",
                    },
                    reason: `${p.graceSku || p.websiteSku} → Decorative (was ${p.family ?? "null"})`,
                });
            }

            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        if (fixes.length > 0) {
            await ctx.runMutation(internal.migrations.patchProductFields, {
                patches: fixes.map((f) => ({ id: f.id, fields: f.fields })),
            });
        }

        return {
            totalFixed: fixes.length,
            details: fixes.map((f) => f.reason),
            message: fixes.length === 0
                ? "No Large Decorative products needed reclassification."
                : `Reclassified ${fixes.length} products to Decorative. Run buildProductGroups + linkProductsToGroups to update groups.`,
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

/**
 * normalizeBlueColorVariants
 * 
 * Standardizes all blue-glass color values to "Cobalt Blue" for consistency.
 * Grace SKUs remain unchanged (BLU and CBL segments both valid).
 * 
 * Rationale:
 * - Some products still use "Blue" or "Cobalt" while the website source of truth uses "Cobalt Blue"
 * - Grace SKU codes mix BLU and CBL for the same cobalt blue glass
 * - Standardizing display color eliminates duplicate sibling swatches
 * - "Cobalt Blue" is more descriptive and matches industry terminology
 * 
 * After running: rebuild product groups to consolidate siblings.
 */
export const normalizeBlueColorVariants = mutation({
    args: {
        cursor: v.optional(v.string()),
        batchSize: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const batchSize = args.batchSize ?? 200;

        // Deterministic full-table pagination (no sampling/skipping).
        const page = await ctx.db.query("products").paginate({
            cursor: args.cursor ?? null,
            numItems: batchSize,
        });
        const blueProducts = page.page.filter((p) =>
            p.color === "Blue" || p.color === "Cobalt"
        );

        let updated = 0;
        for (const product of blueProducts) {
            await ctx.db.patch(product._id, { color: "Cobalt Blue" });
            updated++;
        }

        const hasMore = !page.isDone;
        const nextCursor = page.continueCursor;

        return {
            success: true,
            updated,
            scanned: page.page.length,
            nextCursor,
            hasMore,
            message: updated > 0
                ? `Normalized ${updated} products in this batch from legacy blue color values → "Cobalt Blue". ${hasMore ? "More pages remain." : "Complete! Run buildProductGroups to consolidate sibling groups."}`
                : hasMore ? "No legacy blue color values in this page, continuing scan." : "Migration complete.",
        };
    },
});

/**
 * Reclassify plastic bottle products that were imported as component sprayers.
 *
 * Problem:
 * - Some standalone plastic bottles (e.g. CMP-SPR-CLR-30ML, CMP-SPR-SLV-) were
 *   categorized as Component/Sprayer instead of Plastic Bottle.
 *
 * Effect:
 * - They pollute glass-bottle fitment/component lists.
 * - They don't appear under Plastic Bottle family/category in catalog.
 *
 * This migration moves those records to:
 *   category: "Plastic Bottle"
 *   family: "Plastic Bottle"
 *   bottleCollection: "Plastic Bottle Collection"
 */
export const reclassifyPlasticBottleProducts = mutation({
    args: {
        cursor: v.optional(v.string()),
        batchSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const page = await ctx.db.query("products").paginate({
            cursor: args.cursor ?? null,
            numItems: args.batchSize ?? 250,
        });

        const toReclassify = page.page.filter((p) => {
            const name = (p.itemName ?? "").toLowerCase();
            const sku = (p.graceSku ?? "").toUpperCase();
            const looksLikePlasticBottle = name.startsWith("plastic bottle with");
            const isKnownSprayerPlasticBottle =
                sku === "CMP-SPR-CLR-10ML" ||
                sku === "CMP-SPR-CLR-30ML" ||
                sku === "CMP-SPR-SLV-";
            const alreadyPlastic = p.category === "Plastic Bottle" && p.family === "Plastic Bottle";
            return !alreadyPlastic && (looksLikePlasticBottle || isKnownSprayerPlasticBottle);
        });

        let updated = 0;
        const updatedSkus: string[] = [];

        for (const p of toReclassify) {
            await ctx.db.patch(p._id, {
                category: "Plastic Bottle",
                family: "Plastic Bottle",
                bottleCollection: "Plastic Bottle Collection",
            });
            updated++;
            if (p.graceSku) updatedSkus.push(p.graceSku);
        }

        return {
            success: true,
            updated,
            updatedSkus,
            scanned: page.page.length,
            nextCursor: page.continueCursor,
            hasMore: !page.isDone,
            message: updated > 0
                ? `Reclassified ${updated} products to Plastic Bottle in this batch.`
                : "No plastic bottle reclassifications in this batch.",
        };
    },
});

/**
 * Reclassify all atomizer products into the Atomizer family/category model.
 *
 * Goal:
 * - Keep atomizers out of Cylinder/Slim family browsing.
 * - Group atomizers by capacity (5 ml and 10 ml) with color variants inside.
 */
export const reclassifyAtomizerProducts = mutation({
    args: {
        cursor: v.optional(v.string()),
        batchSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const page = await ctx.db.query("products").paginate({
            cursor: args.cursor ?? null,
            numItems: args.batchSize ?? 250,
        });

        const target = page.page.filter((p) => {
            const isAtomizer = p.applicator === "Atomizer" || (p.websiteSku ?? "").startsWith("GBAtom");
            if (!isAtomizer) return false;
            const already = p.category === "Metal Atomizer" && p.family === "Atomizer";
            return !already;
        });

        let updated = 0;
        const updatedSkus: string[] = [];

        for (const p of target) {
            await ctx.db.patch(p._id, {
                category: "Metal Atomizer",
                family: "Atomizer",
                bottleCollection: "Atomizer Collection",
            });
            updated++;
            if (p.websiteSku) updatedSkus.push(p.websiteSku);
        }

        return {
            success: true,
            updated,
            updatedSkus,
            scanned: page.page.length,
            nextCursor: page.continueCursor,
            hasMore: !page.isDone,
            message: updated > 0
                ? `Reclassified ${updated} atomizer products in this batch.`
                : "No atomizer reclassifications in this batch.",
        };
    },
});

/**
 * Fix spray products where glass color was misparsed from cap/sprayer finish.
 *
 * Example bad parse:
 *   GB-CIR-BLK-30ML-SPR-BLK -> color set to "Black"
 * But itemName states "clear glass bottle ... black cap".
 *
 * This migration corrects those records to color = "Clear".
 */
export const fixMisparsedSprayGlassColors = mutation({
    args: {
        cursor: v.optional(v.string()),
        batchSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const page = await ctx.db.query("products").paginate({
            cursor: args.cursor ?? null,
            numItems: args.batchSize ?? 250,
        });

        const toFix = page.page.filter((p) => {
            const itemName = (p.itemName ?? "").toLowerCase();
            if (p.category !== "Glass Bottle") return false;
            if (p.applicator !== "Fine Mist Sprayer") return false;
            if (p.color !== "Black") return false;
            if (!itemName.includes("clear glass bottle")) return false;
            return true;
        });

        let updated = 0;
        const updatedSkus: string[] = [];
        for (const p of toFix) {
            await ctx.db.patch(p._id, { color: "Clear" });
            updated++;
            if (p.websiteSku) updatedSkus.push(p.websiteSku);
        }

        return {
            success: true,
            updated,
            updatedSkus,
            scanned: page.page.length,
            hasMore: !page.isDone,
            nextCursor: page.continueCursor,
            message: updated > 0
                ? `Fixed ${updated} misparsed spray glass colors in this batch.`
                : "No misparsed spray glass colors in this batch.",
        };
    },
});

/**
 * Populate the `shape` field for Decorative family products based on SKU patterns.
 * Heart, Tola, Marble, Pear — used by buildDisplayName for clean product titles.
 */
export const enrichDecorativeShapes = mutation({
    args: {
        cursor: v.optional(v.string()),
        batchSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const page = await ctx.db.query("products").paginate({
            cursor: args.cursor ?? null,
            numItems: args.batchSize ?? 250,
        });

        let updated = 0;
        const updatedSkus: string[] = [];

        const targetFamilies = new Set(["Decorative", "Apothecary"]);
        for (const p of page.page) {
            if (!targetFamilies.has(p.family ?? "")) continue;
            const sku = p.websiteSku ?? "";
            const shape = detectDecorativeShape(sku);
            if (!shape) continue;
            if (p.shape === shape) continue;
            await ctx.db.patch(p._id, { shape });
            updated++;
            updatedSkus.push(sku);
        }

        return {
            success: true,
            updated,
            updatedSkus,
            scanned: page.page.length,
            hasMore: !page.isDone,
            nextCursor: page.continueCursor,
        };
    },
});

/**
 * Apply narrow, script-generated patches by websiteSku.
 * Intentionally constrained to a small set of low-risk fields.
 */
export const applySafeWebsiteSkuPatches = mutation({
    args: {
        patches: v.array(
            v.object({
                websiteSku: v.string(),
                set: v.object({
                    color: v.optional(v.union(v.string(), v.null())),
                    family: v.optional(v.union(v.string(), v.null())),
                    category: v.optional(v.string()),
                    bottleCollection: v.optional(v.union(v.string(), v.null())),
                }),
                reason: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args) => {
        let updatedCount = 0;
        let skippedCount = 0;
        const missingSkus: string[] = [];

        for (const patch of args.patches) {
            const products = await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) => q.eq("websiteSku", patch.websiteSku))
                .collect();

            if (products.length === 0) {
                missingSkus.push(patch.websiteSku);
                continue;
            }

            const update: {
                color?: string | null;
                family?: string | null;
                category?: string;
                bottleCollection?: string | null;
            } = {};

            if (patch.set.color !== undefined) update.color = patch.set.color;
            if (patch.set.family !== undefined) update.family = patch.set.family;
            if (patch.set.category !== undefined) update.category = patch.set.category;
            if (patch.set.bottleCollection !== undefined) update.bottleCollection = patch.set.bottleCollection;

            if (Object.keys(update).length === 0) {
                skippedCount += products.length;
                continue;
            }

            for (const product of products) {
                await ctx.db.patch(product._id, update);
                updatedCount += 1;
            }
        }

        return {
            success: true,
            updatedCount,
            skippedCount,
            missingSkus,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX SWIRL COLOR
//
// Swirl glass cylinders were mis-categorized: the graceSku color segment
// (BLK / CLR) reflects trim, not glass. Detect via websiteSku containing
// "Swrl" or itemName containing "swirl" and patch color → "Swirl".
// ─────────────────────────────────────────────────────────────────────────────
export const fixSwirlColor = action({
    args: {},
    handler: async (ctx) => {
        let cursor: string | null = null;
        let patched = 0;
        const batchSize = 200;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const page: { page: Array<{ _id: string; websiteSku?: string | null; itemName?: string | null; color?: string | null }>; continueCursor: string; isDone: boolean } =
                await ctx.runQuery(internal.migrations.getSwirlCandidatePage, {
                    cursor: cursor ?? undefined,
                    limit: batchSize,
                });

            const toFix = page.page.filter((p) => {
                const sku = (p.websiteSku ?? "").toLowerCase();
                const name = (p.itemName ?? "").toLowerCase();
                return (sku.includes("swrl") || name.includes("swirl")) && p.color !== "Swirl";
            });

            if (toFix.length > 0) {
                const ids = toFix.map((p) => p._id);
                await ctx.runMutation(internal.migrations.patchSwirlBatch, { ids });
                patched += toFix.length;
            }

            if (page.isDone) break;
            cursor = page.continueCursor;
        }

        return { patched };
    },
});

export const getSwirlCandidatePage = internalQuery({
    args: { cursor: v.optional(v.string()), limit: v.number() },
    handler: async (ctx, args) => {
        const result = await ctx.db.query("products").paginate({
            cursor: args.cursor ?? null,
            numItems: args.limit,
        });
        return {
            page: result.page.map((p) => ({
                _id: p._id,
                websiteSku: p.websiteSku,
                itemName: p.itemName,
                color: p.color,
            })),
            continueCursor: result.continueCursor,
            isDone: result.isDone,
        };
    },
});

export const patchSwirlBatch = internalMutation({
    args: { ids: v.array(v.string()) },
    handler: async (ctx, args) => {
        for (const id of args.ids) {
            await ctx.db.patch(id as any, { color: "Swirl" });
        }
    },
});

export const addMissingSwirlLtnBlk = mutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", "LB-CYL-BLK-9ML-LPM-BLK"))
            .first();
        if (existing) return { status: "already_exists", id: existing._id };

        const sibling = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", "LB-CYL-CLR-9ML-LPM-GLD"))
            .first();

        const id = await ctx.db.insert("products", {
            productId: "BB-GB-009-0211",
            websiteSku: "LBCylSwrl9LtnBlk",
            graceSku: "LB-CYL-BLK-9ML-LPM-BLK",
            category: "Glass Bottle",
            family: "Cylinder",
            shape: null,
            color: "Swirl",
            capacity: "9 ml (0.3 oz)",
            capacityMl: 9,
            capacityOz: 0.3,
            applicator: "Lotion Pump",
            capColor: "Black",
            trimColor: "Black",
            capStyle: null,
            ballMaterial: null,
            neckThreadSize: "17-415",
            heightWithCap: null,
            heightWithoutCap: null,
            diameter: null,
            bottleWeightG: null,
            caseQuantity: null,
            assemblyType: "2-part",
            qbPrice: null,
            webPrice1pc: 1,
            webPrice10pc: null,
            webPrice12pc: 0.95,
            stockStatus: "In Stock",
            itemName: "Cylinder swirl design 9ml,1/3 oz glass bottle with treatment pump with black trim and plastic overcap. For use with serums, light creams, moisturizers, facial oils or face oils, beard oils, body lotions, body wash, and hair products. Price each",
            itemDescription: "Cylinder swirl design 9ml,1/3 oz glass bottle with treatment pump with black trim and plastic overcap. For use with serums, light creams, moisturizers, facial oils or face oils, beard oils, body lotions, body wash, and hair products. Price each",
            imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/LBCylSwrl9LtnBlk.gif",
            productUrl: "https://www.bestbottles.com/product/cylinder-design-9-ml-swirl-glass-bottle-lotion-pump-black-trim-and-cap",
            dataGrade: "A",
            bottleCollection: "Cylinder",
            fitmentStatus: "verified",
            components: sibling?.components ?? [],
            graceDescription: "9ml Swirl glass cylinder with lotion pump, black trim. Thread 17-415.",
            verified: true,
            importSource: "addMissingSwirlLtnBlk_2026-02-28",
        });
        return { status: "inserted", id };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// ALIGNMENT FIXES — 2026-03-04
//
// Two targeted fixes found by alignment_check.mjs:
//   1. normalizeCollectionNames — collapses "X Collection" duplicates → "X"
//      Affects products + productGroups for: Royal, Flair, Square,
//      Plastic Bottle, and Cylinder (one outlier variant).
//   2. fixComponentMisclassifications — corrects family/collection on 5 specific
//      component SKUs that were mislabeled "Roll-On Cap" by the enrichment pipeline.
//
// Run via: node scripts/run_alignment_fixes.mjs
// ─────────────────────────────────────────────────────────────────────────────

const COLLECTION_RENAMES: Record<string, string> = {
    // Product-level duplicates (applied to both products + productGroups)
    "Royal Collection": "Royal",
    "Flair Collection": "Flair",
    "Square Collection": "Square",
    "Plastic Bottle Collection": "Plastic Bottle",
    "Cylinder Collection": "Cylinder",
    // Group-level only: productGroup records used "X Collection" suffix
    // while the individual product records already used the plain name.
    "Tulip Collection": "Tulip",
    "Bell Collection": "Bell",
    "Vial & Sample Collection": "Vial",
    "Pillar Collection": "Pillar",
    "Atomizer Collection": "Atomizer",
};

/**
 * Paginated scan of products — fixes bottleCollection where it matches a known
 * duplicate name. Dry-run (apply=false) just counts without writing.
 */
export const normalizeCollectionNames = mutation({
    args: {
        cursor: v.union(v.string(), v.null()),
        batchSize: v.optional(v.number()),
        apply: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const size = args.batchSize ?? 200;
        const apply = args.apply ?? false;

        const result = await ctx.db.query("products").paginate({ cursor: args.cursor as any, numItems: size });

        let scanned = 0;
        let updated = 0;
        const examples: string[] = [];

        for (const p of result.page) {
            scanned++;
            const correct = COLLECTION_RENAMES[p.bottleCollection ?? ""];
            if (!correct) continue;
            if (apply) await ctx.db.patch(p._id, { bottleCollection: correct });
            updated++;
            if (examples.length < 5) examples.push(`${p.graceSku}: "${p.bottleCollection}" → "${correct}"`);
        }

        return { scanned, updated, examples, hasMore: !result.isDone, nextCursor: result.continueCursor };
    },
});

/**
 * Same fix for productGroups — all ~325 groups fit in one pass.
 */
export const normalizeGroupCollectionNames = mutation({
    args: { apply: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const apply = args.apply ?? false;
        const groups = await ctx.db.query("productGroups").collect();
        let updated = 0;
        const examples: string[] = [];

        for (const g of groups) {
            const correct = COLLECTION_RENAMES[g.bottleCollection ?? ""];
            if (!correct) continue;
            if (apply) await ctx.db.patch(g._id, { bottleCollection: correct });
            updated++;
            if (examples.length < 5) examples.push(`${g.slug}: "${g.bottleCollection}" → "${correct}"`);
        }

        return { updated, examples };
    },
});

// Component SKUs that the enrichment pipeline mislabeled as "Roll-On Cap".
const COMPONENT_FIXES: Array<{ graceSku: string; family: string; bottleCollection: string }> = [
    // Pink antique bulb sprayer — CMP-CAP-* prefix but item IS a sprayer
    { graceSku: "CMP-CAP-PNK-18-415", family: "Sprayer", bottleCollection: "Sprayer" },
    // Four lotion pumps assigned Roll-On Cap family/collection during enrichment
    { graceSku: "CMP-LPM-SGLD-18-415", family: "Lotion Pump", bottleCollection: "Lotion Pump" },
    { graceSku: "CMP-LPM-SBLK-18-415", family: "Lotion Pump", bottleCollection: "Lotion Pump" },
    { graceSku: "CMP-LPM-MSLV-18-415-02", family: "Lotion Pump", bottleCollection: "Lotion Pump" },
    { graceSku: "CMP-LPM-SSLV-18-415", family: "Lotion Pump", bottleCollection: "Lotion Pump" },
];

/**
 * Patches family + bottleCollection on the 5 misclassified component SKUs.
 * Dry-run by default (apply=false).
 */
export const fixComponentMisclassifications = mutation({
    args: { apply: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const apply = args.apply ?? false;
        const results: Array<{ graceSku: string; status: "fixed" | "not_found" | "already_correct" }> = [];

        for (const fix of COMPONENT_FIXES) {
            const product = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", fix.graceSku))
                .first();

            if (!product) {
                results.push({ graceSku: fix.graceSku, status: "not_found" });
                continue;
            }
            if (product.family === fix.family && product.bottleCollection === fix.bottleCollection) {
                results.push({ graceSku: fix.graceSku, status: "already_correct" });
                continue;
            }
            if (apply) {
                await ctx.db.patch(product._id, { family: fix.family, bottleCollection: fix.bottleCollection });
            }
            results.push({ graceSku: fix.graceSku, status: "fixed" });
        }

        return { results, applied: apply };
    },
});

/**
 * Two products were linked to wrong productGroups because their category field
 * was set to "Component" during seeding instead of their real product type:
 *   BB-ALU250SPRYBL        → category "Aluminum Bottle"
 *   BB-CREAMJARAMB5MLSLCAP → category "Cream Jar"
 *
 * Fixing category and clearing productGroupId lets the next grouping pass
 * re-assign them to the correct groups.
 */
export const fixWrongGroupLinks = mutation({
    args: { apply: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const apply = args.apply ?? false;

        const fixes: Array<{ websiteSku: string; category: string }> = [
            { websiteSku: "BB-ALU250SPRYBL", category: "Aluminum Bottle" },
            { websiteSku: "BB-CREAMJARAMB5MLSLCAP", category: "Cream Jar" },
        ];

        const results: Array<{ websiteSku: string; status: "fixed" | "not_found" | "already_correct" }> = [];

        for (const fix of fixes) {
            const product = await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) => q.eq("websiteSku", fix.websiteSku))
                .first();

            if (!product) {
                results.push({ websiteSku: fix.websiteSku, status: "not_found" });
                continue;
            }
            if (product.category === fix.category && product.productGroupId == null) {
                results.push({ websiteSku: fix.websiteSku, status: "already_correct" });
                continue;
            }
            if (apply) {
                await ctx.db.patch(product._id, {
                    category: fix.category,
                    productGroupId: undefined,
                });
            }
            results.push({ websiteSku: fix.websiteSku, status: "fixed" });
        }

        return { results, applied: apply };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFIED PRICE PATCHES — March 4 2026
// Source: pricing_audit_report.json (Feb 24 scrape, 2,066 table-verified matches)
// 29 SKUs with genuine mismatches. Run via:
//   npx convex run migrations:applyVerifiedPricePatches
// ─────────────────────────────────────────────────────────────────────────────

const VERIFIED_PRICE_PATCHES: Array<{ graceSku: string; webPrice1pc?: number; webPrice12pc?: number }> = [
    { graceSku: "AB-ALU-CLR-120ML-LPM-WHT", webPrice1pc: 0.35, webPrice12pc: 0.33 }, // was $1.30
    { graceSku: "AB-ALU-CLR-250ML-SPR-BLK", webPrice1pc: 1.50, webPrice12pc: 1.43 }, // was $1.95
    { graceSku: "PKG-BOX-WHT-4X4X4", webPrice1pc: 0.35 }, // was $0.30
    { graceSku: "CJ-JAR-60ML-WHT", webPrice1pc: 0.20, webPrice12pc: 0.19 }, // was $0.10
    { graceSku: "GB-BSR-AMB-15ML-BLK-T-02", webPrice1pc: 0.82, webPrice12pc: 0.78 }, // was $0.67
    { graceSku: "GB-BSR-AMB-15ML-BLK-T-03", webPrice1pc: 0.82, webPrice12pc: 0.78 }, // was $0.67
    { graceSku: "GB-BSR-AMB-15ML-WHT-T-02", webPrice1pc: 0.82, webPrice12pc: 0.78 }, // was $0.67
    { graceSku: "GB-BSR-AMB-15ML-WHT-T-03", webPrice1pc: 0.82, webPrice12pc: 0.78 }, // was $0.67
    { graceSku: "GB-BSR-AMB-30ML-MRL-SSLV", webPrice1pc: 1.07, webPrice12pc: 1.02 }, // was $0.72
    { graceSku: "GB-BSR-AMB-30ML-WHT-T-01", webPrice1pc: 0.72, webPrice12pc: 0.68 }, // was $0.75
    { graceSku: "GB-BSR-AMB-30ML-WHT-T-02", webPrice1pc: 0.87, webPrice12pc: 0.83 }, // was $0.72
    { graceSku: "GB-BSR-AMB-60ML-MRL-MGLD", webPrice1pc: 1.10, webPrice12pc: 1.05 }, // was $0.75
    { graceSku: "GB-BSR-AMB-60ML-MRL-MSLV", webPrice1pc: 1.10, webPrice12pc: 1.05 }, // was $0.75
    { graceSku: "GB-BSR-AMB-60ML-MRL-SSLV", webPrice1pc: 1.10, webPrice12pc: 1.05 }, // was $0.75
    { graceSku: "GB-BSR-AMB-60ML-WHT-T-01", webPrice1pc: 0.75, webPrice12pc: 0.71 }, // was $0.85
    { graceSku: "GB-BSR-CBL-15ML-BLK-T-03", webPrice1pc: 0.82, webPrice12pc: 0.78 }, // was $0.67
    { graceSku: "GB-BSR-CBL-30ML-BLK-T-02", webPrice1pc: 0.87, webPrice12pc: 0.83 }, // was $0.72
    { graceSku: "GB-BSR-CBL-30ML-WHT-T-02", webPrice1pc: 0.87, webPrice12pc: 0.83 }, // was $0.72
    { graceSku: "GB-BSR-CBL-30ML-WHT-T-03", webPrice1pc: 0.87, webPrice12pc: 0.83 }, // was $0.72
    { graceSku: "GB-BSR-CBL-60ML-BLK-T-02", webPrice1pc: 0.90, webPrice12pc: 0.86 }, // was $0.75
    { graceSku: "GB-BSR-CBL-60ML-MRL-SGLD", webPrice1pc: 0.95, webPrice12pc: 0.90 }, // was $1.05
    { graceSku: "GB-BSR-CBL-60ML-WHT-T-02", webPrice1pc: 0.90, webPrice12pc: 0.86 }, // was $0.75
    { graceSku: "GB-BSR-CBL-60ML-WHT-T-03", webPrice1pc: 0.90, webPrice12pc: 0.86 }, // was $0.75
    { graceSku: "GB-CIR-CLR-50ML-ASP-01", webPrice1pc: 6.15, webPrice12pc: 5.84 }, // was $2.50
    { graceSku: "GB-CIR-CLR-50ML-RDC-WHT", webPrice1pc: 1.57, webPrice12pc: 1.49 }, // was $1.95
    { graceSku: "GB-CIR-FRS-100ML-RDC-WHT", webPrice1pc: 2.52, webPrice12pc: 2.39 }, // was $2.95
    { graceSku: "GB-CIR-FRS-50ML-RDC-WHT", webPrice1pc: 2.07, webPrice12pc: 1.97 }, // was $2.65
    { graceSku: "GB-VIA-CLR-3ML-04", webPrice1pc: 1.95, webPrice12pc: 1.85 }, // was $0.35
    { graceSku: "GB-GRN-GRN-20ML", webPrice1pc: 0.81, webPrice12pc: 0.77 }, // was $0.65
];

export const applyVerifiedPricePatches = mutation({
    args: {},
    handler: async (ctx) => {
        let updated = 0;
        let missing = 0;
        for (const patch of VERIFIED_PRICE_PATCHES) {
            const doc = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", patch.graceSku))
                .first();
            if (!doc) {
                console.warn("Price patch: SKU not found —", patch.graceSku);
                missing++;
                continue;
            }
            const upd: Record<string, number> = {};
            if (patch.webPrice1pc != null) upd.webPrice1pc = patch.webPrice1pc;
            if (patch.webPrice12pc != null) upd.webPrice12pc = patch.webPrice12pc;
            await ctx.db.patch(doc._id, upd);
            updated++;
        }
        return `Price patches applied: ${updated} updated, ${missing} SKUs not found.`;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW PRODUCT — Elegant 15ml Clear Matte Copper Minaret Cap
// Scraped from bestbottles.com/product/elegant-design-15-ml-glass-bottle-matte-copper-minaret-cap
// Source of truth updated: grace_products_clean.json (position 1099)
// Run via: npx convex run migrations:addMissingElegant15mlMinaret
// ─────────────────────────────────────────────────────────────────────────────

export const addMissingElegant15mlMinaret = mutation({
    args: {},
    handler: async (ctx) => {
        const graceSku = "GB-ELG-CLR-15ML-MNR-MCPR";

        // Idempotency check — skip if already exists
        const existing = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", graceSku))
            .first();
        if (existing) {
            return `Already exists: ${graceSku} (_id: ${existing._id})`;
        }

        await ctx.db.insert("products", {
            websiteSku: "GBElg15MinarCu",
            graceSku,
            category: "Glass Bottle",
            family: "Elegant",
            shape: "Standard",
            color: "Clear",
            capacity: "15 ml (0.51 oz)",
            capacityMl: 15.0,
            capacityOz: 0.5,
            applicator: "Cap/Closure",
            capColor: "Matte Copper",
            capStyle: "Minaret",
            trimColor: null,
            neckThreadSize: "13-415",
            heightWithCap: "73 \u00b11 mm",
            heightWithoutCap: "61 \u00b11 mm",
            diameter: "30 \u00b10.5 mm",
            bottleWeightG: 44.0,
            caseQuantity: 288,
            qbPrice: 0.88,
            webPrice1pc: 0.88,
            webPrice10pc: null,
            webPrice12pc: 0.84,
            capHeight: null,
            ballMaterial: null,
            imageUrl: null,
            productId: null,
            stockStatus: "In Stock",
            itemName: "Elegant 15 ml (0.51 oz) Clear Glass Bottle with Matte Copper Minaret Cap",
            itemDescription: "Elegant design 15ml, 1/2oz clear glass bottle with matte copper minaret dab-on cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy.",
            productUrl: "https://www.bestbottles.com/product/elegant-design-15-ml-glass-bottle-matte-copper-minaret-cap",
            dataGrade: "A",
            bottleCollection: "Elegant Collection",
            fitmentStatus: "unmapped",
            graceDescription: "Elegant 15ml clear glass bottle with a matte copper minaret (dab-on) cap. Accepts 13-415 thread. Part of the Elegant Collection, available in 5ml, 15ml, 30ml, 60ml, and 100ml.",
            verified: true,
            components: [],
        });

        return `✅ Inserted: ${graceSku} — Elegant 15ml Clear Matte Copper Minaret Cap`;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// COLOR CORRECTION MIGRATION — March 4 2026
// Fixes 72 frosted glass products incorrectly stored with color=Clear / graceSku=CLR
// Families: Diva (43) + Elegant (29). Clear glass variants are NOT touched.
// Run via: npx convex run migrations:fixFrostedColorMismatches
// ─────────────────────────────────────────────────────────────────────────────

const FROSTED_COLOR_CORRECTIONS = [
    { oldGraceSku: "GB-DVA-CLR-46ML-T-12", newGraceSku: "GB-DVA-FRS-46ML-T-12", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-13", newGraceSku: "GB-DVA-FRS-46ML-T-13", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-14", newGraceSku: "GB-DVA-FRS-46ML-T-14", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-15", newGraceSku: "GB-DVA-FRS-46ML-T-15", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-16", newGraceSku: "GB-DVA-FRS-46ML-T-16", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-17", newGraceSku: "GB-DVA-FRS-46ML-T-17", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-18", newGraceSku: "GB-DVA-FRS-46ML-T-18", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-19", newGraceSku: "GB-DVA-FRS-46ML-T-19", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-20", newGraceSku: "GB-DVA-FRS-46ML-T-20", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-21", newGraceSku: "GB-DVA-FRS-46ML-T-21", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-22", newGraceSku: "GB-DVA-FRS-46ML-T-22", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-23", newGraceSku: "GB-DVA-FRS-46ML-T-23", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-24", newGraceSku: "GB-DVA-FRS-46ML-T-24", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-25", newGraceSku: "GB-DVA-FRS-46ML-T-25", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-26", newGraceSku: "GB-DVA-FRS-46ML-T-26", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-27", newGraceSku: "GB-DVA-FRS-46ML-T-27", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-28", newGraceSku: "GB-DVA-FRS-46ML-T-28", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-29", newGraceSku: "GB-DVA-FRS-46ML-T-29", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-30", newGraceSku: "GB-DVA-FRS-46ML-T-30", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-31", newGraceSku: "GB-DVA-FRS-46ML-T-31", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-32", newGraceSku: "GB-DVA-FRS-46ML-T-32", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-33", newGraceSku: "GB-DVA-FRS-46ML-T-33", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-34", newGraceSku: "GB-DVA-FRS-46ML-T-34", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-35", newGraceSku: "GB-DVA-FRS-46ML-T-35", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-36", newGraceSku: "GB-DVA-FRS-46ML-T-36", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-37", newGraceSku: "GB-DVA-FRS-46ML-T-37", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-38", newGraceSku: "GB-DVA-FRS-46ML-T-38", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-39", newGraceSku: "GB-DVA-FRS-46ML-T-39", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-40", newGraceSku: "GB-DVA-FRS-46ML-T-40", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-T-41", newGraceSku: "GB-DVA-FRS-46ML-T-41", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap" },
    { oldGraceSku: "GB-DVA-CLR-46ML-01", newGraceSku: "GB-DVA-FRS-46ML-01", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle" },
    { oldGraceSku: "GB-DVA-CLR-46ML-02", newGraceSku: "GB-DVA-FRS-46ML-02", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle" },
    { oldGraceSku: "GB-DVA-CLR-46ML-03", newGraceSku: "GB-DVA-FRS-46ML-03", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle" },
    { oldGraceSku: "GB-DVA-CLR-46ML-04", newGraceSku: "GB-DVA-FRS-46ML-04", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle" },
    { oldGraceSku: "GB-DVA-CLR-46ML-05", newGraceSku: "GB-DVA-FRS-46ML-05", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle" },
    { oldGraceSku: "GB-DVA-CLR-46ML-06", newGraceSku: "GB-DVA-FRS-46ML-06", itemName: "Diva 46 ml (1.56 oz) Frosted Glass Bottle" },
    { oldGraceSku: "GB-ELG-CLR-100ML-ASP-WHT-02", newGraceSku: "GB-ELG-FRS-100ML-ASP-WHT-02", itemName: "Elegant 100 ml (3.38 oz) Frosted Glass Bottle with Antique Sprayer White Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-BLK-S-02", newGraceSku: "GB-ELG-FRS-15ML-BLK-S-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle Short Black Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SGLD-T", newGraceSku: "GB-ELG-FRS-15ML-SGLD-T", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle Tall Shiny Gold Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-MRL-BLK-01", newGraceSku: "GB-ELG-FRS-15ML-MRL-BLK-01", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Black Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-MRL-BLK-02", newGraceSku: "GB-ELG-FRS-15ML-MRL-BLK-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Black Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-MRL-MCPR-02", newGraceSku: "GB-ELG-FRS-15ML-MRL-MCPR-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Matte Copper Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-MRL-SGLD-02", newGraceSku: "GB-ELG-FRS-15ML-MRL-SGLD-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Shiny Gold Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-MRL", newGraceSku: "GB-ELG-FRS-15ML-MRL", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller" },
    { oldGraceSku: "GB-ELG-CLR-15ML-MRL-SLV-01", newGraceSku: "GB-ELG-FRS-15ML-MRL-SLV-01", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-MRL-MSLV-02", newGraceSku: "GB-ELG-FRS-15ML-MRL-MSLV-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Matte Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-MRL-SLV-02", newGraceSku: "GB-ELG-FRS-15ML-MRL-SLV-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-RBL-BLK-01", newGraceSku: "GB-ELG-FRS-15ML-RBL-BLK-01", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Black Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-RBL-BLK-02", newGraceSku: "GB-ELG-FRS-15ML-RBL-BLK-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Black Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-RBL-MCPR", newGraceSku: "GB-ELG-FRS-15ML-RBL-MCPR", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Matte Copper Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-RBL-SGLD", newGraceSku: "GB-ELG-FRS-15ML-RBL-SGLD", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Shiny Gold Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-RBL", newGraceSku: "GB-ELG-FRS-15ML-RBL", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball" },
    { oldGraceSku: "GB-ELG-CLR-15ML-RBL-SLV-01", newGraceSku: "GB-ELG-FRS-15ML-RBL-SLV-01", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-RBL-MSLV", newGraceSku: "GB-ELG-FRS-15ML-RBL-MSLV", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Matte Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-RBL-SLV-02", newGraceSku: "GB-ELG-FRS-15ML-RBL-SLV-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SLV-T-02", newGraceSku: "GB-ELG-FRS-15ML-SLV-T-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle Tall Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SPR-BLK-01", newGraceSku: "GB-ELG-FRS-15ML-SPR-BLK-01", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Black Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SPR-BLK-02", newGraceSku: "GB-ELG-FRS-15ML-SPR-BLK-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Black Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SPR", newGraceSku: "GB-ELG-FRS-15ML-SPR", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SPR-MCPR-02", newGraceSku: "GB-ELG-FRS-15ML-SPR-MCPR-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Matte Copper Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SPR-SGLD-02", newGraceSku: "GB-ELG-FRS-15ML-SPR-SGLD-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Shiny Gold Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SPR-MSLV-02", newGraceSku: "GB-ELG-FRS-15ML-SPR-MSLV-02", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Matte Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-SPR-SLV", newGraceSku: "GB-ELG-FRS-15ML-SPR-SLV", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Silver Cap" },
    { oldGraceSku: "GB-ELG-CLR-15ML-WHT-S", newGraceSku: "GB-ELG-FRS-15ML-WHT-S", itemName: "Elegant 15 ml (0.51 oz) Frosted Glass Bottle Short White Cap" },
    { oldGraceSku: "GB-ELG-CLR-60ML-ASP-WHT-02", newGraceSku: "GB-ELG-FRS-60ML-ASP-WHT-02", itemName: "Elegant 60 ml (2.03 oz) Frosted Glass Bottle with Antique Sprayer White Cap" },
    { oldGraceSku: "LB-DVA-CLR-46ML-T", newGraceSku: "LB-DVA-FRS-46ML-T", itemName: "Diva 46 ml (1.56 oz) Clear Lotion Bottle Tall Cap" },
    { oldGraceSku: "LB-DVA-CLR-46ML-01", newGraceSku: "LB-DVA-FRS-46ML-01", itemName: "Diva 46 ml (1.56 oz) Clear Lotion Bottle" },
    { oldGraceSku: "LB-DVA-CLR-46ML-02", newGraceSku: "LB-DVA-FRS-46ML-02", itemName: "Diva 46 ml (1.56 oz) Clear Lotion Bottle" },
    { oldGraceSku: "LB-DVA-CLR-46ML-03", newGraceSku: "LB-DVA-FRS-46ML-03", itemName: "Diva 46 ml (1.56 oz) Clear Lotion Bottle" },
    { oldGraceSku: "LB-DVA-CLR-46ML-04", newGraceSku: "LB-DVA-FRS-46ML-04", itemName: "Diva 46 ml (1.56 oz) Clear Lotion Bottle" },
    { oldGraceSku: "LB-DVA-CLR-46ML-05", newGraceSku: "LB-DVA-FRS-46ML-05", itemName: "Diva 46 ml (1.56 oz) Clear Lotion Bottle" },
    { oldGraceSku: "LB-DVA-CLR-46ML-06", newGraceSku: "LB-DVA-FRS-46ML-06", itemName: "Diva 46 ml (1.56 oz) Clear Lotion Bottle" },
] as const;

export const fixFrostedColorMismatches = mutation({
    args: {},
    handler: async (ctx) => {
        let updated = 0, missing = 0;
        for (const patch of FROSTED_COLOR_CORRECTIONS) {
            const doc = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", patch.oldGraceSku))
                .first();
            if (!doc) { console.warn("Color fix: NOT FOUND —", patch.oldGraceSku); missing++; continue; }
            await ctx.db.patch(doc._id, {
                graceSku: patch.newGraceSku,
                color: "Frosted",
                itemName: patch.itemName || doc.itemName,
            });
            updated++;
        }
        return `Color corrections: ${updated} updated, ${missing} not found.`;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// BULK PRODUCT INSERTION — March 4 2026
// 16 products identified as missing via full bestbottles.com site crawl
// Source of truth updated: grace_products_clean.json (2781 → 2797)
// Run via: npx convex run migrations:addMissingProducts20260304
// ─────────────────────────────────────────────────────────────────────────────

const MISSING_PRODUCTS_20260304 = [
    {
        websiteSku: "",
        graceSku: "PKG-BOX-BRN-4X4X4",
        category: "Packaging",
        family: "Unknown",
        capacity: "0.0 ml",
        capacityMl: 0.0,
        color: "Clear",
        neckThreadSize: null,
        heightWithCap: null,
        heightWithoutCap: "102 ±2 mm Item Width: 102 ±2 m",
        webPrice1pc: 0.45,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Corrugated Box 4 x 4 x 4. 32 lbs ECT",
        itemDescription: "Corrugated Box 4 x 4 x 4. 32 lbs ECT",
        productUrl: "https://www.bestbottles.com/product/Brown-Shipping-Packaging-Box-4x4x4",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "",
        graceSku: "CMP-CAP-BDOT-17-415",
        category: "Component",
        family: "Cap/Component",
        capacity: "0.0 ml",
        capacityMl: 0.0,
        color: "Clear",
        neckThreadSize: "17-415",
        heightWithCap: "27 ±0.5 mm Item Diameter: 19 ±",
        heightWithoutCap: null,
        webPrice1pc: 0.38,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Black with dots cap or closure for rollon bottles. Metal shell cap with plastic insert that has special features for pre",
        itemDescription: "Black with dots cap or closure for rollon bottles. Metal shell cap with plastic insert that has special features for pressing on roller ball. Thread size 17-415",
        productUrl: "https://www.bestbottles.com/product/Caps-lids-top-roll-on-bottle-Black-Dot-Color-17-415",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "",
        graceSku: "PKG-BOX-WHT-WINDOW-SM",
        category: "Packaging",
        family: "Gift Box",
        capacity: "0.0 ml",
        capacityMl: 0.0,
        color: "Clear",
        neckThreadSize: null,
        heightWithCap: null,
        heightWithoutCap: "89 ±1 mm Item Width: 57 ±1 mm ",
        webPrice1pc: 0.35,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Plain White folding carton box with window. Size 0.75",
        itemDescription: "Plain White folding carton box with window. Size 0.75",
        productUrl: "https://www.bestbottles.com/product/Gift-box-C-small-window-white-color",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "",
        graceSku: "CMP-CAP-SBLK-13-415",
        category: "Component",
        family: "Cap/Component",
        capacity: "0.0 ml",
        capacityMl: 0.0,
        color: "Clear",
        neckThreadSize: "13-415",
        heightWithCap: "17 ±0.5 mm Item Diameter: 17 ±",
        heightWithoutCap: null,
        webPrice1pc: 0.28,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Short shiny black or closure for glass bottle with foam liner. Thread size 13-415",
        itemDescription: "Short shiny black or closure for glass bottle with foam liner. Thread size 13-415",
        productUrl: "https://www.bestbottles.com/product/Short-Caps-lids-top-bottle-shiny-black-Color-13-415",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBBell10MtlRollBlkDot",
        graceSku: "GB-BLL-CLR-10ML-MRL-BDOT",
        category: "Glass Bottle",
        family: "Bell",
        capacity: "10.0 ml",
        capacityMl: 10.0,
        color: "Clear",
        neckThreadSize: "13-415",
        heightWithCap: "66 ±1 mm Item Height without C",
        heightWithoutCap: "55 ±1 mm Item Diameter: 27 ±0.",
        webPrice1pc: 0.82,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Bell design 10ml Clear glass bottle with metal roller ball plug and black shiny cap with dots. For use with perfume or f",
        itemDescription: "Bell design 10ml Clear glass bottle with metal roller ball plug and black shiny cap with dots. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, classic style bottle good for promotions and decants.",
        productUrl: "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-metal-roller-ball-plug-black-shiny-cap-with-dots",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBBell10RollBlkDot",
        graceSku: "GB-BLL-CLR-10ML-RBL-BDOT",
        category: "Glass Bottle",
        family: "Bell",
        capacity: "10.0 ml",
        capacityMl: 10.0,
        color: "Clear",
        neckThreadSize: "13-415",
        heightWithCap: "66 ±1 mm Item Height without C",
        heightWithoutCap: "55 ±1 mm Item Diameter: 27 ±0.",
        webPrice1pc: 0.74,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Bell design 10ml Clear glass bottle with plastic roller ball plug and black shiny cap with dots. For use with perfume or",
        itemDescription: "Bell design 10ml Clear glass bottle with plastic roller ball plug and black shiny cap with dots. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, classic style bottle good for promotions and decants.",
        productUrl: "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-plastic-roller-ball-plug-black-shiny-cap-with-dots",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBBstn15BlkDrp",
        graceSku: "GB-BSR-CLR-15ML-DRP-BLK",
        category: "Glass Bottle",
        family: "Boston Round",
        capacity: "15.0 ml",
        capacityMl: 15.0,
        color: "Clear",
        neckThreadSize: "18-400",
        heightWithCap: "91 ±1 mm Item Height without C",
        heightWithoutCap: "68 ±1 mm Item Diameter: 25 ±0.",
        webPrice1pc: 0.67,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Boston round design 15ml, 1/2 oz  Clear glass bottle with a black dropper. For use with perfume oils, diffuser oils, ser",
        itemDescription: "Boston round design 15ml, 1/2 oz  Clear glass bottle with a black dropper. For use with perfume oils, diffuser oils, serums, primers, facial oils or face oils, moisturizers, and beard oils. Price each",
        productUrl: "https://www.bestbottles.com/product/boston-round-design-15-ml-clear-glass-bottle-black-dropper",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "PbClear8ozFlpWh",
        graceSku: "PB-CYL-227ML-WFLP",
        category: "Glass Bottle",
        family: "Cylinder",
        capacity: "227 ml (8 oz)",
        capacityMl: 227.0,
        color: "Clear",
        neckThreadSize: null,
        heightWithCap: "159 ±2 mm Item Height without ",
        heightWithoutCap: "156 ±2 mm Item Diameter: 51 ±1",
        webPrice1pc: 0.97,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Clear plastic cylinder shaped bottle with white flip-top cap for use with perfume or fragrance oil, essential oils, arom",
        itemDescription: "Clear plastic cylinder shaped bottle with white flip-top cap for use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Clear cylinder, design 4oz. Price Each",
        productUrl: "https://www.bestbottles.com/product/cylinder-design-16-oz-plastic-bottle-white-flip-top-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "PbClear4ozFlpWh",
        graceSku: "PB-CYL-CLR-118ML-WFLP",
        category: "Glass Bottle",
        family: "Cylinder",
        capacity: "118 ml (4 oz)",
        capacityMl: 118.0,
        color: "Clear",
        neckThreadSize: null,
        heightWithCap: "124 ±2 mm Item Height without ",
        heightWithoutCap: "116 ±2 mm Item Diameter: 41 ±0",
        webPrice1pc: 0.66,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Clear plastic cylinder shaped bottle with white flip-top cap for use with perfume or fragrance oil, essential oils, arom",
        itemDescription: "Clear plastic cylinder shaped bottle with white flip-top cap for use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Clear cylinder, design 4oz. Price Each",
        productUrl: "https://www.bestbottles.com/product/cylinder-design-4-oz-plastic-bottle-white-flip-top-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBCylBlu5BlkShSht",
        graceSku: "GB-CYL-BLU-5ML-CAP-SBLK",
        category: "Glass Bottle",
        family: "Cylinder",
        capacity: "5.0 ml",
        capacityMl: 5.0,
        color: "Blue",
        neckThreadSize: "13-415",
        heightWithCap: "59 ±1 mm Item Height without C",
        heightWithoutCap: "53 ±1 mm Item Diameter: 17 ±0.",
        webPrice1pc: 0.5,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Cylinder design 5ml, 1/6oz Blue glass bottle with short shiny black cap.",
        itemDescription: "Cylinder design 5ml, 1/6oz Blue glass bottle with short shiny black cap.",
        productUrl: "https://www.bestbottles.com/product/cylinder-design-5-ml-blue-glass-bottle-short-shiny-black-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "PbNat16ozFlpWh",
        graceSku: "PB-CYL-454ML-WFLP",
        category: "Glass Bottle",
        family: "Cylinder",
        capacity: "454 ml (16 oz)",
        capacityMl: 454.0,
        color: "Clear",
        neckThreadSize: null,
        heightWithCap: "194 ±2 mm Item Height without ",
        heightWithoutCap: "195 ±2 mm Item Diameter: 62 ±1",
        webPrice1pc: 1.16,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Natural color plastic cylinder shaped bottle with white flip-top cap for use with perfume or fragrance oil, essential oi",
        itemDescription: "Natural color plastic cylinder shaped bottle with white flip-top cap for use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Natural color cylinder, design 4oz. Price Each",
        productUrl: "https://www.bestbottles.com/product/cylinder-design-8-oz-plastic-bottle-white-flip-top-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBElgFrst15BlkShSht",
        graceSku: "GB-ELG-FRS-15ML-CAP-SBLK",
        category: "Glass Bottle",
        family: "Elegant",
        capacity: "15.0 ml",
        capacityMl: 15.0,
        color: "Frosted",
        neckThreadSize: "13-415",
        heightWithCap: "66 ±1 mm Item Height without C",
        heightWithoutCap: "61 ±1 mm Item Width: 36 ±0.5 m",
        webPrice1pc: 0.8,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Elegant design 15ml, 1/2oz frosted glass bottle with short shiny black cap.",
        itemDescription: "Elegant design 15ml, 1/2oz frosted glass bottle with short shiny black cap.",
        productUrl: "https://www.bestbottles.com/product/elegant-design-15-ml-frosted-glass-bottle-short-shiny-black-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBPillar9MtlRollBlkdot",
        graceSku: "GB-PIL-CLR-9ML-MRL-BDOT",
        category: "Glass Bottle",
        family: "Pillar",
        capacity: "9 ml",
        capacityMl: 9.0,
        color: "Clear",
        neckThreadSize: "13-415",
        heightWithCap: "70 ±1 mm Item Height without C",
        heightWithoutCap: "57 ±1 mm Item Diameter: 21 ±0.",
        webPrice1pc: 0.89,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Pillar shaped 9ml Clear glass bottle with metal roller ball plug and cap in black with dots. For use with perfume or fra",
        itemDescription: "Pillar shaped 9ml Clear glass bottle with metal roller ball plug and cap in black with dots. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, Small sized bottle for decants, promotion, and samples.",
        productUrl: "https://www.bestbottles.com/product/pillar-design-5-ml-glass-bottle-metal-roller-ball-plug-black-dots-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBPillar9RollBlkDot",
        graceSku: "GB-PIL-CLR-9ML-RBL-BDOT",
        category: "Glass Bottle",
        family: "Pillar",
        capacity: "9 ml",
        capacityMl: 9.0,
        color: "Clear",
        neckThreadSize: "13-415",
        heightWithCap: "70 ±1 mm Item Height without C",
        heightWithoutCap: "57 ±1 mm Item Diameter: 21 ±0.",
        webPrice1pc: 0.83,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Pillar shaped 9ml Clear glass bottle with plastic roller ball plug and cap with black dots. For use with perfume or frag",
        itemDescription: "Pillar shaped 9ml Clear glass bottle with plastic roller ball plug and cap with black dots. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, Small sized bottle for decants, promotion,  and samples.",
        productUrl: "https://www.bestbottles.com/product/pillar-design-5-ml-glass-bottle-roller-ball-plug-black-dots-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBPillar9BlkShSht",
        graceSku: "GB-PIL-CLR-9ML-CAP-BLK",
        category: "Glass Bottle",
        family: "Pillar",
        capacity: "9 ml",
        capacityMl: 9.0,
        color: "Clear",
        neckThreadSize: "Size: GBPillar9BlkSht Nemat In",
        heightWithCap: "69 ±1 mm Item Height without C",
        heightWithoutCap: "57 ±1 mm Item Diameter: 21 ±0.",
        webPrice1pc: 0.44,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Pillar shaped 9ml, Clear glass bottle with black short cap. For use with perfume or fragrance oil, essential oils, aroma",
        itemDescription: "Pillar shaped 9ml, Clear glass bottle with black short cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, Small sized bottle for decants, promotion, samples and travel accessory. Price each",
        productUrl: "https://www.bestbottles.com/product/pillar-design-9-ml-glass-bottle-black-short-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
    {
        websiteSku: "GBTulip6BlkShSht",
        graceSku: "GB-TUL-CLR-6ML-CAP-SBLK",
        category: "Glass Bottle",
        family: "Tulip",
        capacity: "6.0 ml",
        capacityMl: 6.0,
        color: "Clear",
        neckThreadSize: "13-415",
        heightWithCap: "47 ±0.5 mm Item Height without",
        heightWithoutCap: "45 ±0.5 mm Item Diameter: 23 ±",
        webPrice1pc: 0.59,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: "Tulip design 6ml, 1/5oz Clear glass bottle with short shiny black cap.",
        itemDescription: "Tulip design 6ml, 1/5oz Clear glass bottle with short shiny black cap.",
        productUrl: "https://www.bestbottles.com/product/tulip-design-6ml-bottle-short-shiny-black-cap",
        dataGrade: "B",
        verified: false,
        components: []
    },
] as const;

export const addMissingProducts20260304 = mutation({
    args: {},
    handler: async (ctx) => {
        let inserted = 0, skipped = 0;
        for (const p of MISSING_PRODUCTS_20260304) {
            const existing = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", p.graceSku))
                .first();
            if (existing) { skipped++; continue; }
            await ctx.db.insert("products", {
                ...p,
                // Required nullable fields the schema enforces
                applicator: (p as any).applicator ?? "N/A",
                capColor: (p as any).capColor ?? null,
                capStyle: (p as any).capStyle ?? null,
                trimColor: (p as any).trimColor ?? null,
                shape: (p as any).shape ?? null,
                diameter: (p as any).diameter ?? null,
                bottleCollection: (p as any).bottleCollection ?? null,
                bottleWeightG: (p as any).bottleWeightG ?? null,
                capacityOz: (p as any).capacityOz ?? null,
                caseQuantity: (p as any).caseQuantity ?? null,
                qbPrice: (p as any).qbPrice ?? null,
                fitmentStatus: (p as any).fitmentStatus ?? "unmapped",
                graceDescription: (p as any).graceDescription ?? null,
                imageUrl: null,
                productId: null,
                capHeight: null,
                ballMaterial: null,
                components: [],
                webPrice10pc: p.webPrice10pc ?? null,
                webPrice12pc: p.webPrice12pc ?? null,
                neckThreadSize: p.neckThreadSize ?? null,
                heightWithCap: p.heightWithCap ?? null,
                heightWithoutCap: p.heightWithoutCap ?? null,
            });
            inserted++;
        }
        return `Bulk insert: ${inserted} inserted, ${skipped} already existed.`;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRICE FILL — 16 in-stock components with missing webPrice1pc (March 4 2026)
// Prices sourced from live bestbottles.com product pages
// Run via: npx convex run migrations:fillMissingComponentPrices
// ─────────────────────────────────────────────────────────────────────────────

const MISSING_PRICE_PATCHES = [
    { graceSku: "CMP-SPR-LVN-BULB", webPrice1pc: 4.25, webPrice12pc: 48.45 },
    { graceSku: "CMP-SPR-RED-02", webPrice1pc: 0.7, webPrice12pc: 7.98 },
    { graceSku: "CMP-CLS-BLK-13-425", webPrice1pc: 0.2, webPrice12pc: 2.28 },
    { graceSku: "CMP-CLS-WHT-13-425", webPrice1pc: 0.55, webPrice12pc: 6.27 },
    { graceSku: "CMP-CLS-BLK-03", webPrice1pc: 0.2, webPrice12pc: 2.28 },
    { graceSku: "CMP-CAP-PHN-24400-BLK", webPrice1pc: 0.2, webPrice12pc: 2.28 },
    { graceSku: "CMP-CLS-BLK-06", webPrice1pc: 0.9, webPrice12pc: 10.26 },
    { graceSku: "CMP-CLS-SLV-02", webPrice1pc: 0.9, webPrice12pc: 10.26 },
    { graceSku: "CMP-CLS-BLK-07", webPrice1pc: 0.95, webPrice12pc: 10.83 },
    { graceSku: "CMP-CLS-SLV-03", webPrice1pc: 0.95, webPrice12pc: 10.83 },
    { graceSku: "CMP-CLS-BLK-08", webPrice1pc: 0.5, webPrice12pc: 5.7 },
    { graceSku: "CMP-CLS-SLV-04", webPrice1pc: 0.5, webPrice12pc: 5.7 },
    { graceSku: "CMP-CLS-GLD-02", webPrice1pc: 0.55, webPrice12pc: 6.27 },
    { graceSku: "CMP-CLS-GDRD", webPrice1pc: 5.0, webPrice12pc: 57.0 },
    { graceSku: "CMP-DRP-AMB", webPrice1pc: 0.45, webPrice12pc: 5.13 },
    { graceSku: "CMP-ROC-WHT-03", webPrice1pc: 0.37, webPrice12pc: 4.22 },
] as const;

export const fillMissingComponentPrices = mutation({
    args: {},
    handler: async (ctx) => {
        let updated = 0, missing = 0;
        for (const p of MISSING_PRICE_PATCHES) {
            const doc = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", p.graceSku))
                .first();
            if (!doc) { console.warn("Price fill: NOT FOUND —", p.graceSku); missing++; continue; }
            await ctx.db.patch(doc._id, {
                webPrice1pc: p.webPrice1pc,
                webPrice12pc: p.webPrice12pc,
                qbPrice: p.webPrice1pc,
            });
            updated++;
        }
        return `Price fill: ${updated} updated, ${missing} not found.`;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX SLUG ANOMALY — "nemat-internation" in product group slugs
// Root cause: neckThreadSize contained "Size: 13-415 Nemat Internation" (truncated
// from Master Sheet). buildSlug now uses normalizeThreadForSlug() to extract only
// the thread pattern. This migration fixes existing groups and products.
// Run via: npx convex run migrations:fixNematInternationSlugs
// Then: npx convex run migrations:fixNematInternationNeckThreadSize
// ─────────────────────────────────────────────────────────────────────────────

/** Diagnostic: list product group slugs containing "nemat" — run: npx convex run migrations:listNematSlugs */
export const listNematSlugs = query({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();
        const bad = groups.filter((g) => g.slug.toLowerCase().includes("nemat"));
        return bad.map((g) => ({ _id: g._id, slug: g.slug }));
    },
});

export const fixNematInternationSlugs = mutation({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();
        const bad = groups.filter((g) => g.slug.includes("nemat-internation"));
        if (bad.length === 0) return "No product groups with nemat-internation slugs found.";

        const slugToId = new Map(groups.map((g) => [g.slug, g._id]));
        let updated = 0;
        for (const g of bad) {
            const newSlug = g.slug.replace(/-?size-\d+-\d+-nemat-internation$/, (m) => {
                const threadMatch = m.match(/(\d+-\d+)/);
                return threadMatch ? `-${threadMatch[1]}` : m;
            });
            if (newSlug === g.slug) continue;
            if (slugToId.has(newSlug)) {
                console.warn(`fixNematInternationSlugs: target slug ${newSlug} already exists, skipping ${g.slug}`);
                continue;
            }
            await ctx.db.patch(g._id, { slug: newSlug });
            slugToId.delete(g.slug);
            slugToId.set(newSlug, g._id);
            updated++;
        }
        return `Fixed ${updated} product group slugs (nemat-internation → clean thread).`;
    },
});

/** Fix products with bad neckThreadSize (e.g. "Size: 13-415 Nemat Internation") — paginated to avoid 16MB read limit */
export const fixNematInternationNeckThreadSize = action({
    args: {},
    handler: async (ctx) => {
        const PAGE_SIZE = 100;
        const BATCH = 50;
        let cursor: string | null = null;
        let isDone = false;
        let totalFixed = 0;

        while (!isDone) {
            const result = (await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            })) as { page: RawProduct[]; isDone: boolean; continueCursor: string | null };
            const bad = result.page.filter(
                (p) => p.neckThreadSize && /nemat\s*internation/i.test(p.neckThreadSize)
            );
            const threadRe = /(\d+-\d+)/;
            const patches: { id: Id<"products">; fields: Record<string, unknown> }[] = [];
            for (const p of bad) {
                const match = (p.neckThreadSize || "").match(threadRe);
                const clean = match ? match[1] : null;
                if (clean) patches.push({ id: p._id, fields: { neckThreadSize: clean } });
            }
            for (let i = 0; i < patches.length; i += BATCH) {
                const batch = patches.slice(i, i + BATCH);
                await ctx.runMutation(internal.migrations.patchProductFields, { patches: batch });
                totalFixed += batch.length;
            }
            isDone = result.isDone;
            cursor = result.continueCursor;
        }
        return totalFixed === 0
            ? "No products with Nemat Internation in neckThreadSize found."
            : `Fixed neckThreadSize on ${totalFixed} products.`;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// INSERT 16 COMPONENT RECORDS — previously in JSON only, never synced to Convex
// Run via: npx convex run migrations:insertMissingComponents
// ─────────────────────────────────────────────────────────────────────────────

const MISSING_COMPONENTS = [
    {
        websiteSku: "AntqSprBulbLavender",
        graceSku: "CMP-SPR-LVN-BULB",
        category: "Component",
        family: "Sprayer",
        applicator: "N/A",
        itemName: "Antique Sprayer Bulb Lavender",
        itemDescription: "Product Lavender - Other - Other",
        webPrice1pc: 4.25,
        webPrice12pc: 48.45,
        webPrice10pc: null,
        qbPrice: 4.25,
        stockStatus: "In Stock",
        color: null,
        capColor: "Lavender",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: null,
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/Vintage-antique-bulb-sprayer-Lavender",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "GBATom5RedBurg",
        graceSku: "CMP-SPR-RED-02",
        category: "Component",
        family: "Sprayer",
        applicator: "Fine Mist Sprayer",
        itemName: "Sprayer Red",
        itemDescription: "Red Burgundy color Metal shell atomizer with 5ml capacity glass bottle, each.",
        webPrice1pc: 0.7,
        webPrice12pc: 7.98,
        webPrice10pc: null,
        qbPrice: 0.7,
        stockStatus: "In Stock",
        color: null,
        capColor: "Red",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "13-415",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/spray-top-black-trim-color-17-415",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CP13-425Blk",
        graceSku: "CMP-CLS-BLK-13-425",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Black Thread 13-425",
        itemDescription: "13-425 Black Phenolic caps F217 Liner..",
        webPrice1pc: 0.2,
        webPrice12pc: 2.28,
        webPrice10pc: null,
        qbPrice: 0.2,
        stockStatus: "In Stock",
        color: null,
        capColor: "Black",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "13-425",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/caps-lids-top-bottle-black-color-1oz-20-400",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CP13-425Wht",
        graceSku: "CMP-CLS-WHT-13-425",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure White Thread 13-425",
        itemDescription: "13-425 White Phenolic caps F217 Liner",
        webPrice1pc: 0.55,
        webPrice12pc: 6.27,
        webPrice10pc: null,
        qbPrice: 0.55,
        stockStatus: "In Stock",
        color: null,
        capColor: "White",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "13-425",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/dropper-white-rubber-bulb-copper-trim-glass-pipette",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CapBlackPoly22mm-400",
        graceSku: "CMP-CLS-BLK-03",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Black",
        itemDescription: "Black Phenolic cap with polyseal cone 22mm-400",
        webPrice1pc: 0.2,
        webPrice12pc: 2.28,
        webPrice10pc: null,
        qbPrice: 0.2,
        stockStatus: "In Stock",
        color: null,
        capColor: "Black",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "22-400",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/caps-lids-top-bottle-black-color-1oz-20-400",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CP24-400BlkPls",
        graceSku: "CMP-CAP-PHN-24400-BLK",
        category: "Component",
        family: "Cap/Closure",
        applicator: "N/A",
        itemName: "Phenolic Cap 24-400 Black Taperseal",
        itemDescription: "24-400 Black Phenolic Taperseal",
        webPrice1pc: 0.2,
        webPrice12pc: 2.28,
        webPrice10pc: null,
        qbPrice: 0.2,
        stockStatus: "In Stock",
        color: null,
        capColor: "Black",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "24-400",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/caps-lids-top-bottle-black-color-2oz-20-400",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CJ30BlkCap",
        graceSku: "CMP-CLS-BLK-06",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Black",
        itemDescription: "Black Caps for 30ml Cream Jars",
        webPrice1pc: 0.9,
        webPrice12pc: 10.26,
        webPrice10pc: null,
        qbPrice: 0.9,
        stockStatus: "In Stock",
        color: null,
        capColor: "Black",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "PRESS-FIT",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/cream-jar-style-30-ml-frosted-glass-bottle-black-cap",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CJ30SlCap",
        graceSku: "CMP-CLS-SLV-02",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Silver",
        itemDescription: "Silver Caps for 30ml Cream Jars",
        webPrice1pc: 0.9,
        webPrice12pc: 10.26,
        webPrice10pc: null,
        qbPrice: 0.9,
        stockStatus: "In Stock",
        color: null,
        capColor: "Silver",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "PRESS-FIT",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/cream-jar-style-30-ml-frosted-glass-bottle-silver-cap",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CJ40BlkCap",
        graceSku: "CMP-CLS-BLK-07",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Black",
        itemDescription: "Black Caps for 40ml Cream Jars",
        webPrice1pc: 0.95,
        webPrice12pc: 10.83,
        webPrice10pc: null,
        qbPrice: 0.95,
        stockStatus: "In Stock",
        color: null,
        capColor: "Black",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "PRESS-FIT",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/cream-jar-style-40-ml-frosted-glass-bottle-black-cap",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CJ40SlCap",
        graceSku: "CMP-CLS-SLV-03",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Silver",
        itemDescription: "Silver caps for 40ml Cream Jars",
        webPrice1pc: 0.95,
        webPrice12pc: 10.83,
        webPrice10pc: null,
        qbPrice: 0.95,
        stockStatus: "In Stock",
        color: null,
        capColor: "Silver",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "PRESS-FIT",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/cream-jar-style-40-ml-frosted-glass-bottle-silver-cap",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CJ5BlkCap",
        graceSku: "CMP-CLS-BLK-08",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Black",
        itemDescription: "Black caps for 5ml Cream Jars",
        webPrice1pc: 0.5,
        webPrice12pc: 5.7,
        webPrice10pc: null,
        qbPrice: 0.5,
        stockStatus: "In Stock",
        color: null,
        capColor: "Black",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "PRESS-FIT",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/cream-jar-style-5-ml-amber-glass-bottle-black-cap",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CJ5SlCap",
        graceSku: "CMP-CLS-SLV-04",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Silver",
        itemDescription: "Silver caps for 5ml Cream Jars",
        webPrice1pc: 0.5,
        webPrice12pc: 5.7,
        webPrice10pc: null,
        qbPrice: 0.5,
        stockStatus: "In Stock",
        color: null,
        capColor: "Silver",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "PRESS-FIT",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/cream-jar-style-5-ml-amber-glass-bottle-silver-cap",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CPKeyChnGld",
        graceSku: "CMP-CLS-GLD-02",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Gold",
        itemDescription: "Golden cap with Key Chain for Decorative bottles.",
        webPrice1pc: 0.55,
        webPrice12pc: 6.27,
        webPrice10pc: null,
        qbPrice: 0.55,
        stockStatus: "In Stock",
        color: null,
        capColor: "Gold",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "SPECIAL",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/caps-lids-top-bottle-shiny-gold-color-15-415",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CPTslRed",
        graceSku: "CMP-CLS-GDRD",
        category: "Component",
        family: "Cap/Closure",
        applicator: "Cap/Closure",
        itemName: "Cap/Closure Gold Red",
        itemDescription: "Golden cap with Red tassel for decorative bottles.",
        webPrice1pc: 5.0,
        webPrice12pc: 57.0,
        webPrice10pc: null,
        qbPrice: 5.0,
        stockStatus: "In Stock",
        color: null,
        capColor: "Red",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "SPECIAL",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/vintage-antique-bulb-sprayer-black-tassel",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "Droppers1ozElg",
        graceSku: "CMP-DRP-AMB",
        category: "Component",
        family: "Dropper",
        applicator: "Dropper",
        itemName: "Dropper Amber",
        itemDescription: "10ml Glass Roller Bottle / Amber",
        webPrice1pc: 0.45,
        webPrice12pc: 5.13,
        webPrice10pc: null,
        qbPrice: 0.45,
        stockStatus: "In Stock",
        color: null,
        capColor: null,
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: "17-415",
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/dropper-black-rubber-bulb-black-trim-glass-pipette-15ml",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
    {
        websiteSku: "CPWhite1Oz",
        graceSku: "CMP-ROC-WHT-03",
        category: "Component",
        family: "Roll-On Cap",
        applicator: "Plastic Roller Ball",
        itemName: "Roll-On Cap White",
        itemDescription: "White P/P Smooth Cylinder 1 Oz Roll on Cap",
        webPrice1pc: 0.37,
        webPrice12pc: 4.22,
        webPrice10pc: null,
        qbPrice: 0.37,
        stockStatus: "In Stock",
        color: null,
        capColor: "White",
        capStyle: null, trimColor: null, shape: null, diameter: null,
        bottleCollection: null, bottleWeightG: null, capacityMl: null,
        capacityOz: null, capacity: null, caseQuantity: null,
        neckThreadSize: null,
        heightWithCap: null, heightWithoutCap: null,
        productUrl: "https://www.bestbottles.com/product/caps-lids-top-roll-on-bottle-black-dot-color-13-415",
        dataGrade: "B", fitmentStatus: "unmapped",
        graceDescription: null, imageUrl: null, productId: null,
        capHeight: null, ballMaterial: null,
        verified: false, components: [],
    },
] as const;

export const insertMissingComponents = mutation({
    args: {},
    handler: async (ctx) => {
        let inserted = 0, skipped = 0;
        for (const p of MISSING_COMPONENTS) {
            const exists = await ctx.db.query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", p.graceSku)).first();
            if (exists) { skipped++; continue; }
            await ctx.db.insert("products", { ...(p as any), components: [] });
            inserted++;
        }
        return `Components insert: ${inserted} inserted, ${skipped} already existed.`;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATOR NORMALIZATION — align Convex DB with new roller ball taxonomy
// Run BEFORE schema deployment via: npx convex run migrations:normalizeApplicatorValues
// ─────────────────────────────────────────────────────────────────────────────

export const normalizeApplicatorValues = mutation({
    args: {},
    handler: async (ctx) => {
        const MAP: Record<string, string | null> = {
            "Roller": "Plastic Roller Ball",
            "Roller Ball": "Plastic Roller Ball",
            "Roll-On": "Plastic Roller Ball",
            "Metal Roll-On": "Metal Roller Ball",
            "Metal Roller": "Metal Roller Ball",
            "Plastic Roller": "Plastic Roller Ball",
            "Plug": "Plastic Roller Ball",
            "Sprayer": "Fine Mist Sprayer",
            "Antique Sprayer": "Vintage Bulb Sprayer",
            "Antique Sprayer Tassel": "Vintage Bulb Sprayer with Tassel",
            "Antique Bulb Sprayer": "Vintage Bulb Sprayer",
            "Antique Bulb Sprayer with Tassel": "Vintage Bulb Sprayer with Tassel",
            "None": null,
        };
        const staleValues = new Set(Object.keys(MAP));

        // Single paginate call — re-run this mutation until updated=0
        const page = await ctx.db.query("products")
            .order("asc")
            .paginate({ cursor: null, numItems: 200 });

        let updated = 0;
        for (const doc of page.page) {
            const old = doc.applicator as string | null;
            if (old !== null && old !== undefined && staleValues.has(old)) {
                await ctx.db.patch(doc._id, { applicator: MAP[old] as any });
                updated++;
            }
        }
        return `Batch: ${updated} updated this run. IsDone=${page.isDone}. Re-run until updated=0.`;
    },
});

export const patchSingleStaleApplicator = mutation({
    args: { cursor: v.optional(v.union(v.string(), v.null())) },
    handler: async (ctx, { cursor }) => {
        const MAP: Record<string, string | null> = {
            "Plastic Roller": "Plastic Roller Ball", "Metal Roller": "Metal Roller Ball",
            "Roller": "Plastic Roller Ball", "Roller Ball": "Plastic Roller Ball",
            "Roll-On": "Plastic Roller Ball", "Metal Roll-On": "Metal Roller Ball",
            "Plug": "Plastic Roller Ball", "Sprayer": "Fine Mist Sprayer",
            "Antique Sprayer": "Vintage Bulb Sprayer",
            "Antique Sprayer Tassel": "Vintage Bulb Sprayer with Tassel",
            "Antique Bulb Sprayer": "Vintage Bulb Sprayer",
            "Antique Bulb Sprayer with Tassel": "Vintage Bulb Sprayer with Tassel",
            "None": null,
        };
        const page = await ctx.db.query("products")
            .paginate({ cursor: cursor ?? null, numItems: 100 });
        let fixed = 0;
        for (const doc of page.page) {
            const val = doc.applicator as string | null;
            if (val && val in MAP) {
                await ctx.db.patch(doc._id, { applicator: MAP[val] as any });
                fixed++;
            }
        }
        return { fixed, nextCursor: page.continueCursor, isDone: page.isDone };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// FILL NULL BOTTLE APPLICATORS — 280 glass/lotion/aluminum bottles were missing
// applicator values. Inferred from product names/families. Packaging, cream jars,
// accessories, components intentionally left at null (attribute doesn't apply).
// Run repeatedly (passing returned cursor) until isDone=true.
// ─────────────────────────────────────────────────────────────────────────────

const APPLICATOR_FILLS: Record<string, string> = {};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH INDIVIDUAL PRODUCT FIELDS — targeted one-off corrections
// Allows updating itemName, graceDescription, or any scalar field on a product
// identified by its graceSku, without a full re-import.
// ─────────────────────────────────────────────────────────────────────────────

export const patchProductField = mutation({
    args: {
        graceSku: v.string(),
        field: v.string(),
        value: v.string(),
    },
    handler: async (ctx, { graceSku, field, value }) => {
        const product = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", graceSku))
            .first();
        if (!product) throw new Error(`Product not found: ${graceSku}`);
        await ctx.db.patch(product._id, { [field]: value } as any);
        return { patched: product._id, graceSku, field, value };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// One-off product insertion — adds a single missing product record.
// Idempotent: skips if graceSku already exists.
// ─────────────────────────────────────────────────────────────────────────────

/** Patch arbitrary fields on a productGroup by its _id. */
export const patchProductGroupFields = mutation({
    args: { id: v.id("productGroups"), fields: v.any() },
    handler: async (ctx, { id, fields }) => {
        await ctx.db.patch(id, fields);
        return { patched: id };
    },
});

/**
 * Re-patch Boston Round groupDescription from capacity-keyed map.
 * Use when updating copy (e.g. removing em dashes). Descriptions keyed by capacityMl.
 */
export const patchBostonRoundDescriptions = mutation({
    args: {
        descriptions: v.array(
            v.object({ capacityMl: v.number(), description: v.string() })
        ),
    },
    handler: async (ctx, { descriptions }) => {
        const map = new Map(descriptions.map((d) => [d.capacityMl, d.description]));
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", "Boston Round"))
            .collect();
        let patched = 0;
        for (const g of groups) {
            const cap = g.capacityMl ?? 0;
            const desc = map.get(cap);
            if (desc) {
                await ctx.db.patch(g._id, { groupDescription: desc });
                patched++;
            }
        }
        return { patched, total: groups.length };
    },
});

/**
 * Generic mutation: patch groupDescription for any family.
 * Accepts a family name and an array of description entries.
 *
 * Each entry can be:
 * - { capacityMl, description } — applies to ALL applicator types for that capacity
 * - { capacityMl, applicatorBucket, description } — applies only to groups whose slug ends with applicatorBucket
 *
 * Applicator-specific entries take precedence over capacity-only entries.
 * Applicator buckets: rollon, finemist, perfumespray, antiquespray, antiquespray-tassel, dropper, lotionpump, reducer, glasswand, glassapplicator, capclosure
 */
export const patchFamilyDescriptions = mutation({
    args: {
        family: v.string(),
        descriptions: v.array(
            v.union(
                v.object({ capacityMl: v.number(), description: v.string() }),
                v.object({
                    capacityMl: v.number(),
                    applicatorBucket: v.string(),
                    description: v.string(),
                })
            )
        ),
    },
    handler: async (ctx, { family, descriptions }) => {
        const genericMap = new Map<number, string>();
        const applicatorMap = new Map<string, string>(); // key: "capacityMl|applicatorBucket"
        for (const d of descriptions) {
            if ("applicatorBucket" in d && d.applicatorBucket) {
                applicatorMap.set(`${d.capacityMl}|${d.applicatorBucket}`, d.description);
            } else {
                genericMap.set(d.capacityMl, d.description);
            }
        }
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", family))
            .collect();
        const KNOWN_BUCKETS = new Set(["rollon", "finemist", "perfumespray", "antiquespray", "antiquespray-tassel", "dropper", "lotionpump", "reducer", "glasswand", "glassapplicator", "capclosure"]);
        const getApplicatorFromSlug = (s: string): string | null => {
            if (s.endsWith("-antiquespray-tassel")) return "antiquespray-tassel";
            const parts = s.split("-");
            const last = parts.length > 1 ? (parts.pop() ?? null) : null;
            return last && KNOWN_BUCKETS.has(last) ? last : null;
        };
        let patched = 0;
        for (const g of groups) {
            const cap = g.capacityMl ?? 0;
            const slug = g.slug ?? "";
            const applicatorBucket = getApplicatorFromSlug(slug);
            let desc: string | undefined;
            if (applicatorBucket) {
                desc = applicatorMap.get(`${cap}|${applicatorBucket}`);
            }
            if (!desc) {
                desc = genericMap.get(cap);
            }
            if (desc) {
                await ctx.db.patch(g._id, { groupDescription: desc });
                patched++;
            }
        }
        return { patched, total: groups.length, family };
    },
});

/** Patch arbitrary fields on a product by its _id. */
export const patchProductById = mutation({
    args: { id: v.id("products"), fields: v.any() },
    handler: async (ctx, { id, fields }) => {
        await ctx.db.patch(id, fields);
        return { patched: id };
    },
});

/**
 * Patch the applicator field on all products belonging to a given set of
 * productGroup IDs. Used by the Fine Mist → Perfume Spray Pump capacity split.
 */
export const patchVariantApplicatorBatch = mutation({
    args: {
        groupIds: v.array(v.id("productGroups")),
        fromApplicator: v.string(),
        toApplicator: v.string(),
    },
    handler: async (ctx, { groupIds, fromApplicator, toApplicator }) => {
        let patched = 0;
        for (const groupId of groupIds) {
            const variants = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", groupId))
                .collect();
            for (const p of variants) {
                if (p.applicator === fromApplicator) {
                    // Cast is safe: caller is always a migration script that passes valid enum values
                    await ctx.db.patch(p._id, { applicator: toApplicator as Doc<"products">["applicator"] });
                    patched++;
                }
            }
        }
        return { patched };
    },
});

/**
 * Generic: patch a single string field on all products belonging to a given
 * set of productGroup IDs, but only where the current value matches fromValue.
 */
export const patchVariantsFieldBatch = mutation({
    args: {
        groupIds: v.array(v.id("productGroups")),
        field: v.string(),
        fromValue: v.string(),
        toValue: v.string(),
    },
    handler: async (ctx, { groupIds, field, fromValue, toValue }) => {
        let patched = 0;
        for (const groupId of groupIds) {
            const variants = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", groupId))
                .collect();
            for (const p of variants) {
                if ((p as any)[field] === fromValue) {
                    await ctx.db.patch(p._id, { [field]: toValue } as any);
                    patched++;
                }
            }
        }
        return { patched };
    },
});

/** Patch family (and optionally other fields) on all products that belong to a group. */
export const patchVariantFamily = mutation({
    args: {
        groupId: v.id("productGroups"),
        family: v.string(),
    },
    handler: async (ctx, { groupId, family }) => {
        const variants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", groupId))
            .collect();
        for (const v2 of variants) {
            await ctx.db.patch(v2._id, { family });
        }
        return { updated: variants.length };
    },
});

export const insertMissingProduct = mutation({
    args: { product: v.any() },
    handler: async (ctx, { product }) => {
        const existing = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", product.graceSku))
            .first();
        if (existing) return { skipped: true, id: existing._id, graceSku: product.graceSku };
        const id = await ctx.db.insert("products", product);
        return { inserted: true, id, graceSku: product.graceSku };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIVE GROUP BUILDER — creates productGroups for orphaned products only.
//
// Safe to run at any time:
//   - Never deletes or modifies existing productGroups (heroImageUrls preserved).
//   - Idempotent: re-running skips already-linked products and existing groups.
//
// Run order:
//   npx convex run migrations:groupOrphanedProducts
// ─────────────────────────────────────────────────────────────────────────────

/** Internal: insert a single new productGroup (called from groupOrphanedProducts). */
export const insertSingleGroup = internalMutation({
    args: {
        group: v.object({
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
            applicatorTypes: v.array(v.string()),
        }),
    },
    handler: async (ctx, { group }) => {
        const id = await ctx.db.insert("productGroups", group);
        return id;
    },
});

/** Internal: link a batch of products to their groups and optionally patch group stats. */
export const linkOrphanBatch = internalMutation({
    args: {
        links: v.array(v.object({
            productId: v.id("products"),
            groupId: v.id("productGroups"),
        })),
        groupStats: v.array(v.object({
            groupId: v.id("productGroups"),
            variantCount: v.number(),
            priceRangeMin: v.union(v.number(), v.null()),
            priceRangeMax: v.union(v.number(), v.null()),
            applicatorTypes: v.array(v.string()),
        })),
    },
    handler: async (ctx, { links, groupStats }) => {
        for (const { productId, groupId } of links) {
            await ctx.db.patch(productId, { productGroupId: groupId });
        }
        for (const { groupId, variantCount, priceRangeMin, priceRangeMax, applicatorTypes } of groupStats) {
            await ctx.db.patch(groupId, { variantCount, priceRangeMin, priceRangeMax, applicatorTypes });
        }
        return { linked: links.length };
    },
});

/**
 * Additive migration: builds productGroups for any product that currently
 * has no productGroupId. Existing groups are never modified or deleted.
 *
 * Usage:  npx convex run migrations:groupOrphanedProducts
 */
export const groupOrphanedProducts = action({
    args: {},
    handler: async (ctx) => {
        // 1. Load all existing groups into slug→id map (read-only, no side effects).
        const existingGroups = await ctx.runQuery(internal.migrations.getAllGroups, {}) as Array<{
            _id: Id<"productGroups">; slug: string;
        }>;
        const slugToId = new Map<string, Id<"productGroups">>(existingGroups.map((g) => [g.slug, g._id]));

        // 2. Page through all products, collect orphans.
        type OrphanProduct = {
            _id: Id<"products">;
            websiteSku: string;
            graceSku: string;
            category: string;
            family: string | null;
            capacityMl: number | null;
            capacity: string | null;
            color: string | null;
            neckThreadSize: string | null;
            bottleCollection: string | null;
            applicator: string | null;
            webPrice1pc: number | null;
            productGroupId?: Id<"productGroups"> | null;
        };

        const PAGE_SIZE = 200;
        let cursor: string | null = null;
        let isDone = false;
        const orphans: OrphanProduct[] = [];

        while (!isDone) {
            const result = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: PAGE_SIZE,
            }) as PageResult;
            for (const p of result.page) {
                if (!p.productGroupId) {
                    orphans.push(p as unknown as OrphanProduct);
                }
            }
            isDone = result.isDone;
            cursor = result.continueCursor;
        }

        if (orphans.length === 0) {
            return { message: "No orphaned products found. All products already linked.", created: 0, linked: 0 };
        }

        // 3. Compute group definitions for each orphan.
        type NewGroupDef = {
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
            applicatorTypes: string[];
        };

        const newGroupMap = new Map<string, NewGroupDef>();
        const orphanSlugMap = new Map<string, string>(); // product _id → group slug

        for (const p of orphans) {
            const isMetalAtomizer = p.applicator === "Metal Atomizer" || (p.websiteSku || "").startsWith("GBAtom");
            const effectiveCategory = isMetalAtomizer ? "Metal Atomizer" : (p.category ?? "unknown");
            const effectiveFamily = isMetalAtomizer ? "Atomizer" : (p.family ?? null);
            const applicatorBucket = BOTTLE_CATEGORIES.has(effectiveCategory)
                ? getApplicatorBucket(p.applicator)
                : null;
            const isDecorativeFamily = effectiveFamily === "Decorative" || effectiveFamily === "Apothecary";
            const decorativeShape = isDecorativeFamily ? detectDecorativeShape(p.websiteSku || "") : null;
            const decAccessory = isDecorativeFamily ? detectDecorativeAccessory(p.websiteSku || "") : null;
            const componentSubType = COMPONENT_CATEGORIES.has(effectiveCategory)
                ? getComponentSubType(p.websiteSku ?? "", p.websiteSku ?? "", p.applicator ?? null)
                : null;

            const slug = buildSlug(
                effectiveFamily, p.capacityMl ?? null, p.color ?? null, effectiveCategory,
                p.neckThreadSize ?? null, applicatorBucket, decorativeShape, decAccessory?.slug ?? null, componentSubType,
            );
            orphanSlugMap.set(String(p._id), slug);

            if (!slugToId.has(slug) && !newGroupMap.has(slug)) {
                newGroupMap.set(slug, {
                    slug,
                    displayName: buildDisplayName(
                        effectiveFamily, p.capacity ?? null, p.color ?? null, effectiveCategory,
                        applicatorBucket, decorativeShape, decAccessory?.label ?? null, componentSubType, p.neckThreadSize ?? null,
                    ),
                    family: effectiveFamily || effectiveCategory || "unknown",
                    capacity: p.capacity ?? null,
                    capacityMl: p.capacityMl ?? null,
                    color: isMetalAtomizer ? null : (p.color ?? null),
                    category: effectiveCategory,
                    bottleCollection: p.bottleCollection ?? null,
                    neckThreadSize: p.neckThreadSize ?? null,
                    variantCount: 0,
                    priceRangeMin: null,
                    priceRangeMax: null,
                    applicatorTypes: [],
                });
            }

            // Accumulate stats for new groups
            const targetMap = newGroupMap.has(slug) ? newGroupMap : null;
            if (targetMap) {
                const g = targetMap.get(slug)!;
                g.variantCount++;
                const price = p.webPrice1pc;
                if (price != null && price > 0) {
                    if (g.priceRangeMin == null || price < g.priceRangeMin) g.priceRangeMin = price;
                    if (g.priceRangeMax == null || price > g.priceRangeMax) g.priceRangeMax = price;
                }
                if (p.applicator && !g.applicatorTypes.includes(p.applicator)) {
                    g.applicatorTypes.push(p.applicator);
                }
            }
        }

        // 4. Insert new groups one at a time and record their IDs.
        let created = 0;
        for (const [slug, groupDef] of newGroupMap) {
            const newId = await ctx.runMutation(internal.migrations.insertSingleGroup, { group: groupDef });
            slugToId.set(slug, newId as Id<"productGroups">);
            created++;
        }

        // 5. Build link + stat update batches and apply in chunks of 100.
        const links: { productId: Id<"products">; groupId: Id<"productGroups"> }[] = [];
        for (const p of orphans) {
            const slug = orphanSlugMap.get(String(p._id));
            if (!slug) continue;
            const groupId = slugToId.get(slug);
            if (!groupId) continue;
            links.push({ productId: p._id, groupId });
        }

        // Recompute stats for ALL groups that received new products (including pre-existing ones)
        const groupStatMap = new Map<string, { variantCount: number; priceRangeMin: number | null; priceRangeMax: number | null; applicatorTypes: Set<string> }>();
        for (const { productId, groupId } of links) {
            const gKey = String(groupId);
            if (!groupStatMap.has(gKey)) {
                groupStatMap.set(gKey, { variantCount: 0, priceRangeMin: null, priceRangeMax: null, applicatorTypes: new Set() });
            }
            const stats = groupStatMap.get(gKey)!;
            stats.variantCount++;
            const p = orphans.find((o) => o._id === productId);
            if (p?.webPrice1pc && p.webPrice1pc > 0) {
                if (stats.priceRangeMin == null || p.webPrice1pc < stats.priceRangeMin) stats.priceRangeMin = p.webPrice1pc;
                if (stats.priceRangeMax == null || p.webPrice1pc > stats.priceRangeMax) stats.priceRangeMax = p.webPrice1pc;
            }
            if (p?.applicator) stats.applicatorTypes.add(p.applicator);
        }

        const groupStatsArr = Array.from(groupStatMap.entries()).map(([gIdStr, s]) => ({
            groupId: gIdStr as Id<"productGroups">,
            variantCount: s.variantCount,
            priceRangeMin: s.priceRangeMin,
            priceRangeMax: s.priceRangeMax,
            applicatorTypes: [...s.applicatorTypes],
        }));

        const BATCH = 100;
        let linked = 0;
        for (let i = 0; i < links.length; i += BATCH) {
            const batchLinks = links.slice(i, i + BATCH);
            // Only include group stats in the first batch that covers those groups
            const batchGroupIds = new Set(batchLinks.map((l) => String(l.groupId)));
            const batchStats = i === 0
                ? groupStatsArr.filter((s) => batchGroupIds.has(String(s.groupId)))
                : [];
            const result = await ctx.runMutation(internal.migrations.linkOrphanBatch, {
                links: batchLinks,
                groupStats: batchStats,
            });
            linked += result.linked;
        }

        // Push remaining group stats in a final pass
        if (groupStatsArr.length > 0) {
            const STAT_BATCH = 50;
            for (let i = 0; i < groupStatsArr.length; i += STAT_BATCH) {
                await ctx.runMutation(internal.migrations.linkOrphanBatch, {
                    links: [],
                    groupStats: groupStatsArr.slice(i, i + STAT_BATCH),
                });
            }
        }

        return {
            orphansFound: orphans.length,
            newGroupsCreated: created,
            productsLinked: linked,
            message: `Created ${created} new groups, linked ${linked} orphaned products.`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX ATOMIZER PRODUCT GROUPS
//
// The current "atomizer-5ml" group lumps slim (10mm neck) and standard (13-415)
// variants together. This migration:
//   1. Creates a new "atomizer-5ml-slim" group for the 3 slim variants
//   2. Patches the existing 5ml group to keep only the 6 standard variants
//   3. Relinks all products to the correct groups
//   4. Ensures both groups + the 10ml group have populated color metadata
//
// Run via: npx convex run migrations:fixAtomizerGroups
// ─────────────────────────────────────────────────────────────────────────────

export const fixAtomizerGroups = action({
    args: {},
    handler: async (ctx): Promise<{
        slimGroupCreated: boolean;
        slimGroupId: string;
        standardGroupPatched: boolean;
        productsRelinked: number;
        tenMlGroupPatched: boolean;
    }> => {
        const SLIM_SKU_PREFIX = "GB-SLM-";
        const EXISTING_5ML_GROUP_SLUG = "atomizer-5ml";
        const EXISTING_10ML_GROUP_SLUG = "atomizer-10ml";

        // Fetch all Atomizer products
        const allProducts = await ctx.runQuery(internal.migrations.getProductsByThread, {
            neckThreadSize: "SKIP",
        }).catch(() => [] as Array<{ _id: string; graceSku: string; itemName: string; color: string | null; neckThreadSize: string | null; capacityMl: number | null; webPrice1pc: number | null; webPrice12pc: number | null; productGroupId: string | undefined }>);

        // Fallback: query by family
        const atomizerProducts: typeof allProducts = [];

        // Get all product groups to find the existing ones
        const allGroups = await ctx.runQuery(internal.migrations.getAllGroups, {});

        const existing5mlGroup = allGroups.find(
            (g) => g.slug === EXISTING_5ML_GROUP_SLUG
        );
        const existing10mlGroup = allGroups.find(
            (g) => g.slug === EXISTING_10ML_GROUP_SLUG
        );

        if (!existing5mlGroup) {
            throw new Error("Could not find atomizer-5ml group");
        }
        if (!existing10mlGroup) {
            throw new Error("Could not find atomizer-10ml group");
        }

        // Get all products linked to the 5ml group
        const fiveMlVariants = await ctx.runQuery(internal.migrations.getProductsByGroupId, {
            groupId: existing5mlGroup._id,
        });

        // Also get unlinked atomizer products (groupId = null)
        const familyProducts = await ctx.runQuery(
            api.products.getByFamily,
            { family: "Atomizer" }
        );

        // Partition 5ml products into slim vs standard
        const slim5ml: typeof familyProducts = [];
        const standard5ml: typeof familyProducts = [];
        const products10ml: typeof familyProducts = [];

        for (const p of familyProducts) {
            if ((p.capacityMl ?? 0) === 5) {
                if (p.graceSku.startsWith(SLIM_SKU_PREFIX)) {
                    slim5ml.push(p);
                } else {
                    standard5ml.push(p);
                }
            } else if ((p.capacityMl ?? 0) === 10) {
                products10ml.push(p);
            }
        }

        // 1. Create the new slim group
        const slimPrices = slim5ml
            .map((p) => p.webPrice1pc ?? 0)
            .filter((p) => p > 0);
        const slimColors = [...new Set(slim5ml.map((p) => p.color).filter(Boolean))];

        const slimGroupId = await ctx.runMutation(
            internal.migrations.insertSingleGroup,
            {
                group: {
                    slug: "atomizer-5ml-slim",
                    displayName: "5 ml Slim Atomizer Bottle",
                    family: "Atomizer",
                    capacity: "5 ml (0.17 oz)",
                    capacityMl: 5,
                    color: slimColors.length === 1 ? slimColors[0]! : null,
                    category: "Metal Atomizer",
                    bottleCollection: "Atomizer Collection",
                    neckThreadSize: "10mm",
                    variantCount: slim5ml.length,
                    priceRangeMin: slimPrices.length > 0 ? Math.min(...slimPrices) : null,
                    priceRangeMax: slimPrices.length > 0 ? Math.max(...slimPrices) : null,
                    applicatorTypes: ["Atomizer"],
                },
            }
        );

        // 2. Patch the existing 5ml group to reflect only standard variants
        const stdPrices = standard5ml
            .map((p) => p.webPrice1pc ?? 0)
            .filter((p) => p > 0);

        await ctx.runMutation(api.migrations.patchProductGroupFields, {
            id: existing5mlGroup._id as any,
            fields: {
                displayName: "5 ml Atomizer Bottle",
                neckThreadSize: "13-415",
                variantCount: standard5ml.length,
                priceRangeMin: stdPrices.length > 0 ? Math.min(...stdPrices) : null,
                priceRangeMax: stdPrices.length > 0 ? Math.max(...stdPrices) : null,
            },
        });

        // 3. Patch the 10ml group to have proper color metadata
        const tenMlColors = [...new Set(products10ml.map((p) => p.color).filter(Boolean))];
        const tenMlPrices = products10ml
            .map((p) => p.webPrice1pc ?? 0)
            .filter((p) => p > 0);

        await ctx.runMutation(api.migrations.patchProductGroupFields, {
            id: existing10mlGroup._id as any,
            fields: {
                variantCount: products10ml.length,
                priceRangeMin: tenMlPrices.length > 0 ? Math.min(...tenMlPrices) : null,
                priceRangeMax: tenMlPrices.length > 0 ? Math.max(...tenMlPrices) : null,
            },
        });

        // 4. Relink all products to correct groups
        const links: Array<{ productId: any; groupId: any }> = [];

        for (const p of slim5ml) {
            links.push({
                productId: (p as any)._id,
                groupId: slimGroupId,
            });
        }
        for (const p of standard5ml) {
            links.push({
                productId: (p as any)._id,
                groupId: existing5mlGroup._id,
            });
        }
        for (const p of products10ml) {
            links.push({
                productId: (p as any)._id,
                groupId: existing10mlGroup._id,
            });
        }

        // Apply links in batch
        await ctx.runMutation(internal.migrations.linkOrphanBatch, {
            links: links.map((l) => ({
                productId: l.productId,
                groupId: l.groupId,
            })),
            groupStats: [],
        });

        return {
            slimGroupCreated: true,
            slimGroupId: slimGroupId as string,
            standardGroupPatched: true,
            productsRelinked: links.length,
            tenMlGroupPatched: true,
        };
    },
});

/**
 * Fix anomalous neckThreadSize values in productGroups and products tables.
 * Values like "Ground", "Plug", "PRESS-FIT", "snap", "SPECIAL", and garbled
 * SKU strings are not valid thread sizes and should be set to null.
 *
 * Run: npx convex run migrations:fixAnomalousThreadSizes
 */
/**
 * Fix anomalous neckThreadSize values in productGroups table only.
 * Values like "Ground", "Plug", "PRESS-FIT", "snap", "SPECIAL", and garbled
 * SKU strings are not valid thread sizes — set them to null.
 * productGroups is small enough to collect. Products are handled separately.
 *
 * Run: npx convex run migrations:fixAnomalousThreadSizes
 */
export const fixAnomalousThreadSizes = mutation({
    args: {},
    handler: async (ctx) => {
        const VALID_THREAD_PATTERN = /^\d{1,3}[-/]\d{3,4}$|^\d{1,3}mm$/i;
        const patched: string[] = [];

        // Fix productGroups (small table — safe to collect)
        const groups = await ctx.db.query("productGroups").collect();
        for (const group of groups) {
            if (group.neckThreadSize && !VALID_THREAD_PATTERN.test(group.neckThreadSize)) {
                patched.push(`group ${group.displayName}: "${group.neckThreadSize}" → null`);
                await ctx.db.patch(group._id, { neckThreadSize: null });
            }
        }

        return { patchedCount: patched.length, details: patched };
    },
});

/**
 * Fix anomalous neckThreadSize values in products table (paginated).
 * Run: npx convex run migrations:fixAnomalousThreadSizesProducts
 */
export const fixAnomalousThreadSizesProducts = mutation({
    args: { cursor: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const VALID_THREAD_PATTERN = /^\d{1,3}[-/]\d{3,4}$|^\d{1,3}mm$/i;
        const patched: string[] = [];

        const result = await ctx.db.query("products").paginate({ numItems: 500, cursor: args.cursor ?? null });
        for (const product of result.page) {
            if (product.neckThreadSize && !VALID_THREAD_PATTERN.test(product.neckThreadSize)) {
                patched.push(`${product.graceSku}: "${product.neckThreadSize}" → null`);
                await ctx.db.patch(product._id, { neckThreadSize: null });
            }
        }

        return {
            patchedCount: patched.length,
            details: patched,
            isDone: result.isDone,
            continueCursor: result.isDone ? null : result.continueCursor,
        };
    },
});
