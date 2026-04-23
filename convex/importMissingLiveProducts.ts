import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Migration: Import 8 products that are live + selling on bestbottles.com but
 * missing from Convex. Source of truth = live PDP data crawled 2026-04-22.
 *
 * See: docs/data_alignment/PARITY_FINAL_REPORT.json
 * Raw data: docs/data_alignment/LIVE_ONLY_for_sale_import_ready.json
 *
 * Idempotent: looks up by graceSku first and skips if already present.
 * Safe to re-run.
 *
 * These records are inserted with:
 *   - verified: false               — flag for manual review after import
 *   - importSource: "live_site_parity_20260422_phase1"
 *   - productGroupId: undefined     — left unlinked. Run a downstream mapper
 *                                     (migrations.ts pattern) to attach to
 *                                     the right productGroup after insert.
 *   - graceSku = websiteSku         — placeholder. These 8 need a canonical
 *                                     graceSku assignment in a later pass.
 *
 * Run with: npx convex run importMissingLiveProducts:importMissing
 */

// Price-row shape from the live PDP crawl
type LiveTier = { qty: number; total: string; per_pc: string };
type LiveRecord = {
    slug: string;
    url: string;
    live_sku: string;
    item_type: string;
    item_description: string;
    title: string;
    meta_description: string;
    tiered_pricing: LiveTier[];
};

// Parse "1,428.00" → 1428.00
function parsePrice(s: string | undefined): number | null {
    if (!s) return null;
    const clean = s.replace(/,/g, "").trim();
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : null;
}

// Tier totals on the live site are total per case, per_pc is per-piece.
// Grab 1pc, 12pc, and the closest tier to "10pc" (there isn't always one).
function extractPrices(tiers: LiveTier[]): {
    webPrice1pc: number | null;
    webPrice10pc: number | null;
    webPrice12pc: number | null;
} {
    const byQty = new Map(tiers.map((t) => [t.qty, parsePrice(t.per_pc)]));
    return {
        webPrice1pc: byQty.get(1) ?? null,
        webPrice10pc: null, // live tiers skip "10pc" — leave null
        webPrice12pc: byQty.get(12) ?? null,
    };
}

// The 8 live-only records, enriched with schema-valid category/family/shape/
// applicator/color/capColor/capHeight values. Sourced from the live PDP crawl
// and cross-referenced to existing Convex family conventions.
const LIVE_ONLY_8: Array<
    LiveRecord & {
        // Enriched fields (schema-typed)
        category: string;
        family: string;
        shape: string | null;
        color: string;
        capacity: string;
        capacityMl: number;
        capacityOz: number;
        applicator:
            | "Metal Roller Ball"
            | "Plastic Roller Ball"
            | "Fine Mist Sprayer"
            | "Perfume Spray Pump"
            | "Atomizer"
            | "Lotion Pump"
            | "Cap/Closure";
        capColor: string | null;
        trimColor: string | null;
        capStyle: string | null;
        capHeight: "Short" | "Tall" | null;
        neckThreadSize: string | null;
        bottleCollection: string | null;
    }
> = [
    {
        slug: "black-atomizer-design-5-ml-bottle",
        url: "https://www.bestbottles.com/product/black-atomizer-design-5-ml-bottle",
        live_sku: "GBAtom5Blk",
        item_type: "Refillable Metal shell perfume atomizers and travel size purse atomizers",
        item_description: "Matte Black atomizer design 5 ml bottle. For use with perfumes, Colognes, eau de Parfum. Refillable, travel size atomizer. Can be laser engraved and customized. Great for gifts and promotion.",
        title: "Black atomizer design 5 ml bottle.",
        meta_description: "Wholesale distributor of glass bottles and containers for use with perfumes, Colognes, eau de Parfum. Refillable, travel size atomizer. Black atomizer with sprayer. Capacity: 5 ml, 1/6oz",
        tiered_pricing: [
            { qty: 1, total: "2.80", per_pc: "2.80" },
            { qty: 12, total: "31.92", per_pc: "2.66" },
            { qty: 144, total: "362.88", per_pc: "2.52" },
            { qty: 600, total: "1,428.00", per_pc: "2.38" },
            { qty: 3000, total: "6,552.00", per_pc: "2.18" },
        ],
        category: "Atomizer",
        family: "Atomizer",
        shape: "Standard",
        color: "Black",
        capacity: "5 ml (1/6 oz)",
        capacityMl: 5,
        capacityOz: 0.17,
        applicator: "Atomizer",
        capColor: "Matte Black",
        trimColor: null,
        capStyle: "Metal Shell",
        capHeight: null,
        neckThreadSize: null,
        bottleCollection: "Atomizer Collection",
    },
    {
        slug: "black-atomizer-design-5-ml-bottle-dots",
        url: "https://www.bestbottles.com/product/black-atomizer-design-5-ml-bottle-dots",
        live_sku: "GBAtom5BlkDot",
        item_type: "Refillable Metal shell perfume atomizers and travel size purse atomizers",
        item_description: "Black atomizer design 5 ml bottle with dots. For use with perfumes, Colognes, eau de Parfum. Refillable, travel size atomizer. Can be laser engraved and customized. Great for gifts and promotion.",
        title: "Black atomizer design 5 ml bottle with dots.",
        meta_description: "Wholesale distributor of glass bottles and containers for use with perfumes, Colognes, eau de Parfum. Refillable, travel size atomizer. Black atomizer and sprayer with dots. Capacity: 5 ml, 1/6oz",
        tiered_pricing: [
            { qty: 1, total: "3.05", per_pc: "3.05" },
            { qty: 12, total: "34.77", per_pc: "2.90" },
            { qty: 144, total: "395.28", per_pc: "2.75" },
            { qty: 600, total: "1,555.50", per_pc: "2.59" },
            { qty: 3000, total: "7,137.00", per_pc: "2.38" },
        ],
        category: "Atomizer",
        family: "Atomizer",
        shape: "Standard",
        color: "Black with Dots",
        capacity: "5 ml (1/6 oz)",
        capacityMl: 5,
        capacityOz: 0.17,
        applicator: "Atomizer",
        capColor: "Black with Dots",
        trimColor: null,
        capStyle: "Metal Shell",
        capHeight: null,
        neckThreadSize: null,
        bottleCollection: "Atomizer Collection",
    },
    {
        slug: "cylinder-design-5-ml-glass-bottle-short-white-cap",
        url: "https://www.bestbottles.com/product/cylinder-design-5-ml-glass-bottle-short-white-cap",
        live_sku: "GBCyl5WhtSht",
        item_type: "Classic Glass Bottles With Attractive Caps",
        item_description: "Cylinder design 5.5ml, 1/6oz Clear glass bottle with short white cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, Small sized bottle for decants, promotion, samples and travel accessory.",
        title: "Cylinder design 5ml Clear glass bottle with short white cap.",
        meta_description: "Wholesale Distributor of glass bottles and containers. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Clear glass bottle with short white cap capacity: 5ml, 1/6oz",
        tiered_pricing: [
            { qty: 1, total: "0.31", per_pc: "0.31" },
            { qty: 12, total: "3.53", per_pc: "0.29" },
            { qty: 144, total: "40.18", per_pc: "0.28" },
            { qty: 864, total: "227.66", per_pc: "0.26" },
            { qty: 4320, total: "1,044.58", per_pc: "0.24" },
        ],
        category: "Glass Bottle",
        family: "Cylinder",
        shape: "Standard",
        color: "Clear",
        capacity: "5 ml (1/6 oz)",
        capacityMl: 5,
        capacityOz: 0.17,
        applicator: "Cap/Closure",
        capColor: "Short White",
        trimColor: null,
        capStyle: "Short Cap",
        capHeight: "Short",
        neckThreadSize: "13-415",
        bottleCollection: "Cylinder Collection",
    },
    {
        slug: "cylinder-design-9-ml-swirl-glass-bottle-lotion-pump-black-trim-and-cap",
        url: "https://www.bestbottles.com/product/cylinder-design-9-ml-swirl-glass-bottle-lotion-pump-black-trim-and-cap",
        live_sku: "LBCylSwrl9LtnBlk",
        item_type: "Lotion Bottles",
        item_description: "Cylinder swirl design 9ml,1/3 oz glass bottle with treatment pump with black trim and plastic overcap. For use with serums, light creams, moisturizers, facial oils or face oils, beard oils, body lotions, body wash, and hair products.",
        title: "Cylinder swirl design 9ml glass bottle with treatment pump with black trim and plastic overcap.",
        meta_description: "Wholesale distributor of glass bottles and containers for use with perfume, fragrance oil, essential oil, or aromatherapy. Swirl glass bottle with lotion pump applicator and black trim and cap, capacity: 9ml, (1/3)oz",
        tiered_pricing: [
            { qty: 1, total: "1.00", per_pc: "1.00" },
            { qty: 12, total: "11.40", per_pc: "0.95" },
            { qty: 144, total: "129.60", per_pc: "0.90" },
            { qty: 576, total: "489.60", per_pc: "0.85" },
            { qty: 2880, total: "2,246.40", per_pc: "0.78" },
        ],
        category: "Lotion Bottle",
        family: "Cylinder",
        shape: "Swirl",
        color: "Clear",
        capacity: "9 ml (1/3 oz)",
        capacityMl: 9,
        capacityOz: 0.33,
        applicator: "Lotion Pump",
        capColor: "Black",
        trimColor: "Black",
        capStyle: "Lotion Pump with Overcap",
        capHeight: null,
        neckThreadSize: "17-415",
        bottleCollection: "Cylinder Swirl Collection",
    },
    {
        slug: "cylinder-design-9-ml-swirl-glass-bottle-metal-roller-ball-white-cap",
        url: "https://www.bestbottles.com/product/cylinder-design-9-ml-swirl-glass-bottle-metal-roller-ball-white-cap",
        live_sku: "GBCylSwrl9MtlRollWht",
        item_type: "Clear, frosted and colored glass roll-on bottles with steel roller-balls, capacity range about 1/3oz (from 8ml to 10ml)",
        item_description: "Cylinder swirl design 9ml,1/3 oz glass bottle with metal roller ball plug and white cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy.",
        title: "Cylinder swirl design 9ml glass bottle with metal roller ball plug and white cap.",
        meta_description: "Wholesale distributor of glass bottles and containers for use with perfume, fragrance oil, essential oil, or aromatherapy. Swirl glass bottle with metal roller ball applicator and white cap, capacity: 9ml, (1/3)oz",
        tiered_pricing: [
            { qty: 1, total: "0.76", per_pc: "0.76" },
            { qty: 12, total: "8.66", per_pc: "0.72" },
            { qty: 144, total: "98.50", per_pc: "0.68" },
            { qty: 684, total: "441.86", per_pc: "0.65" },
            { qty: 3420, total: "2,027.38", per_pc: "0.59" },
        ],
        category: "Roll-On Bottle",
        family: "Cylinder",
        shape: "Swirl",
        color: "Clear",
        capacity: "9 ml (1/3 oz)",
        capacityMl: 9,
        capacityOz: 0.33,
        applicator: "Metal Roller Ball",
        capColor: "White",
        trimColor: null,
        capStyle: "Roll-On Cap",
        capHeight: null,
        neckThreadSize: "17-415",
        bottleCollection: "Cylinder Swirl Collection",
    },
    {
        slug: "cylinder-design-9-ml-swirl-glass-bottle-plastic-roller-ball-white-cap",
        url: "https://www.bestbottles.com/product/cylinder-design-9-ml-swirl-glass-bottle-plastic-roller-ball-white-cap",
        live_sku: "GBCylSwrl9RollWht",
        item_type: "Clear, frosted and colored glass roll on bottles of capacity range about 1/3oz (from 8ml to 10ml)",
        item_description: "Cylinder swirl design 9ml,1/3 oz glass bottle with plastic roller ball plug and white cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy.",
        title: "Cylinder swirl design 9ml glass bottle with plastic roller ball plug and white cap.",
        meta_description: "Wholesale distributor of glass bottles and containers for use with perfume, fragrance oil, essential oil, or aromatherapy. Swirl glass bottle with plastic roller  ball applicator and white cap, capacity: 9ml, (1/3)oz",
        tiered_pricing: [
            { qty: 1, total: "0.67", per_pc: "0.67" },
            { qty: 12, total: "7.64", per_pc: "0.64" },
            { qty: 144, total: "86.83", per_pc: "0.60" },
            { qty: 684, total: "389.54", per_pc: "0.57" },
            { qty: 3420, total: "1,787.29", per_pc: "0.52" },
        ],
        category: "Roll-On Bottle",
        family: "Cylinder",
        shape: "Swirl",
        color: "Clear",
        capacity: "9 ml (1/3 oz)",
        capacityMl: 9,
        capacityOz: 0.33,
        applicator: "Plastic Roller Ball",
        capColor: "White",
        trimColor: null,
        capStyle: "Roll-On Cap",
        capHeight: null,
        neckThreadSize: "17-415",
        bottleCollection: "Cylinder Swirl Collection",
    },
    {
        slug: "pink-atomizer-design-5-ml-bottle-dots",
        url: "https://www.bestbottles.com/product/pink-atomizer-design-5-ml-bottle-dots",
        live_sku: "GBAtom5PnkDot",
        item_type: "Refillable Metal shell perfume atomizers and travel size purse atomizers",
        item_description: "Pink atomizer design 5 ml bottle with dots. For use with perfumes, Colognes, eau de Parfum. Refillable, travel size atomizer. Can be laser engraved and customized. Great for gifts and promotion.",
        title: "Pink atomizer design 5 ml bottle with dots.",
        meta_description: "Wholesale distributor of glass bottles and containers for use with perfumes, Colognes, eau de Parfum. Refillable, travel size atomizer. Pink atomizer and sprayer with dots. Capacity: 5 ml, 1/6oz",
        tiered_pricing: [
            { qty: 1, total: "3.05", per_pc: "3.05" },
            { qty: 12, total: "34.77", per_pc: "2.90" },
            { qty: 144, total: "395.28", per_pc: "2.75" },
            { qty: 600, total: "1,555.50", per_pc: "2.59" },
            { qty: 3000, total: "7,137.00", per_pc: "2.38" },
        ],
        category: "Atomizer",
        family: "Atomizer",
        shape: "Standard",
        color: "Pink with Dots",
        capacity: "5 ml (1/6 oz)",
        capacityMl: 5,
        capacityOz: 0.17,
        applicator: "Atomizer",
        capColor: "Pink with Dots",
        trimColor: null,
        capStyle: "Metal Shell",
        capHeight: null,
        neckThreadSize: null,
        bottleCollection: "Atomizer Collection",
    },
    {
        slug: "tall-cylinder-design-9-ml-glass-bottle-short-white-cap",
        url: "https://www.bestbottles.com/product/tall-cylinder-design-9-ml-glass-bottle-short-white-cap",
        live_sku: "GBTallCyl9WhtSht",
        item_type: "Classic Glass Bottles With Attractive Caps",
        item_description: "Tall cylinder design 9ml, 1/3oz Clear glass bottle with short white cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Refillable, slender bottle with attractive heavy base.",
        title: "Tall cylinder design 9ml Clear glass bottle with short white cap.",
        meta_description: "Wholesale Distributor of glass bottles and containers. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. Clear glass bottle with short white cap capacity: 9ml, 1/3oz",
        tiered_pricing: [
            { qty: 1, total: "0.67", per_pc: "0.67" },
            { qty: 12, total: "7.64", per_pc: "0.64" },
            { qty: 144, total: "86.83", per_pc: "0.60" },
            { qty: 288, total: "164.02", per_pc: "0.57" },
            { qty: 1440, total: "752.54", per_pc: "0.52" },
        ],
        category: "Glass Bottle",
        family: "Tall Cylinder",
        shape: "Standard",
        color: "Clear",
        capacity: "9 ml (1/3 oz)",
        capacityMl: 9,
        capacityOz: 0.33,
        applicator: "Cap/Closure",
        capColor: "Short White",
        trimColor: null,
        capStyle: "Short Cap",
        capHeight: "Short",
        neckThreadSize: "13-415",
        bottleCollection: "Tall Cylinder Collection",
    },
];

export const importMissing = internalMutation({
    args: {},
    handler: async (ctx) => {
        const IMPORT_SOURCE = "live_site_parity_20260422_phase1";
        let inserted = 0;
        let skipped = 0;
        const log: Array<{ sku: string; action: "inserted" | "skipped"; reason?: string }> = [];

        for (const rec of LIVE_ONLY_8) {
            // Idempotency: skip if websiteSku OR graceSku already exists.
            // These 8 are live-only by definition, but guard against re-runs.
            const existingByWebsite = await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) => q.eq("websiteSku", rec.live_sku))
                .first();
            const existingByGrace = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", rec.live_sku))
                .first();

            if (existingByWebsite || existingByGrace) {
                skipped++;
                log.push({
                    sku: rec.live_sku,
                    action: "skipped",
                    reason: existingByWebsite
                        ? `websiteSku already exists (_id: ${existingByWebsite._id})`
                        : `graceSku already exists (_id: ${existingByGrace!._id})`,
                });
                continue;
            }

            const prices = extractPrices(rec.tiered_pricing);

            await ctx.db.insert("products", {
                // Identity
                productId: null,
                websiteSku: rec.live_sku,
                graceSku: rec.live_sku, // placeholder — needs canonical graceSku pass
                // Classification
                category: rec.category,
                family: rec.family,
                shape: rec.shape,
                color: rec.color,
                capacity: rec.capacity,
                capacityMl: rec.capacityMl,
                capacityOz: rec.capacityOz,
                // Applicator & Cap
                applicator: rec.applicator,
                capColor: rec.capColor,
                trimColor: rec.trimColor,
                capStyle: rec.capStyle,
                capHeight: rec.capHeight,
                ballMaterial: rec.applicator === "Metal Roller Ball"
                    ? "Metal"
                    : rec.applicator === "Plastic Roller Ball"
                    ? "Plastic"
                    : null,
                // Physical — left null, will be backfilled from master v8.3
                neckThreadSize: rec.neckThreadSize,
                heightWithCap: null,
                heightWithoutCap: null,
                diameter: null,
                bottleWeightG: null,
                caseQuantity: null,
                // Pricing (live site tiers)
                qbPrice: prices.webPrice1pc, // mirror until QB data joined
                webPrice1pc: prices.webPrice1pc,
                webPrice10pc: prices.webPrice10pc,
                webPrice12pc: prices.webPrice12pc,
                // Content & status
                stockStatus: "In Stock",
                itemName: rec.title,
                itemDescription: rec.item_description,
                imageUrl: null,
                productUrl: rec.url,
                dataGrade: "C", // C = live-crawl-only, unverified
                bottleCollection: rec.bottleCollection,
                // Fitment
                fitmentStatus: "unmapped",
                components: [],
                graceDescription: `${rec.item_description} ${rec.meta_description}`.trim(),
                // Meta
                verified: false,
                importSource: IMPORT_SOURCE,
                // Grouping — left unlinked; run a downstream group-mapping pass
                productGroupId: undefined,
            });

            inserted++;
            log.push({ sku: rec.live_sku, action: "inserted" });
        }

        return {
            importSource: IMPORT_SOURCE,
            inserted,
            skipped,
            total: LIVE_ONLY_8.length,
            log,
            nextSteps: [
                "1. Run group-mapping pass to set productGroupId on these 8 records",
                "2. Assign canonical graceSku values (currently = websiteSku = live_sku)",
                "3. Run fitment mapper to set components[] arrays",
                "4. Backfill physical specs (heightWithCap, diameter, bottleWeightG, caseQuantity) from master v8.3",
                "5. Flip verified: true after manual review",
            ],
        };
    },
});
