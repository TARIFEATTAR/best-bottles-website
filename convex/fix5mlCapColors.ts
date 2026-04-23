import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Migration: Populate capColor, applicator, and capHeight for all 5ml Cylinder products.
 *
 * The diagnostic audit showed every 5ml variant has capColor: null. This migration
 * derives the correct capColor from each product's graceSku suffix, and also fixes
 * applicator and capHeight for "Bottle with Cap" products that currently have null applicator.
 *
 * Run with: npx convex run fix5mlCapColors:fix5mlCapColors
 */

// Map graceSku suffix → capColor value (matching what PaperDollImage.tsx CAP_KEY_MAP expects)
const SKU_TO_CAP_COLOR: Record<string, string> = {
    // Roll-on caps
    "SBLK": "Shiny Black",
    "MCPR": "Matte Copper",
    "MGLD": "Matte Gold",
    "SGLD": "Shiny Gold",
    "PKDT": "Pink with Dots",
    "SLDT": "Silver with Dots",
    "MSLV": "Matte Silver",
    "SSLV": "Shiny Silver",
    "BKDT": "Black with Dots",
    "WHT": "White",
    // Sprayer overcaps (same color names)
    "MBLK": "Matte Black",
    "MBLU": "Matte Blue",
    // "Bottle with Cap" tall caps
    "SLV-T": "Shiny Silver",
    "GLD-T": "Shiny Gold",
    // "Bottle with Cap" short caps
    "S": "Short Black",           // GB-CYL-CLR-5ML-S
    "S-01": "Short Black",        // GB-CYL-CBL-5ML-S-01
    "S-02": "Short White",        // GB-CYL-CBL-5ML-S-02
    "CAP-SBLK": "Shiny Black",   // GB-CYL-BLU-5ML-CAP-SBLK
};

// Determine capHeight from SKU
function getCapHeight(sku: string): "Short" | "Tall" | null {
    const suffix = sku.split("-").slice(-1)[0];
    const lastTwo = sku.split("-").slice(-2).join("-");
    // Short caps
    if (lastTwo === "S-01" || lastTwo === "S-02") return "Short";
    if (suffix === "S" && sku.match(/-5ML-S$/)) return "Short";
    if (lastTwo === "CAP-SBLK") return "Short";
    // Tall caps (the "-T" suffix ones)
    if (suffix === "T" && (sku.includes("SLV-T") || sku.includes("GLD-T"))) return "Tall";
    return null;
}

// Extract the relevant suffix from a graceSku for cap color lookup
function extractSuffix(sku: string): string | null {
    // Handle known multi-part suffixes first
    if (sku.endsWith("-CAP-SBLK")) return "CAP-SBLK";
    if (sku.endsWith("-SLV-T")) return "SLV-T";
    if (sku.endsWith("-GLD-T")) return "GLD-T";
    if (sku.endsWith("-S-01")) return "S-01";
    if (sku.endsWith("-S-02")) return "S-02";
    if (sku.match(/-5ML-S$/)) return "S";

    // Standard pattern: GB-CYL-{color}-5ML-{applicator}-{SUFFIX}
    // e.g. GB-CYL-CLR-5ML-MRL-SBLK → SBLK
    // e.g. GB-CYL-CLR-5ML-SPR-MBLK → MBLK
    // e.g. GB-CYL-CLR-5ML-ROL-BKDT → BKDT
    const parts = sku.split("-");
    if (parts.length >= 6) {
        return parts[parts.length - 1];
    }
    return null;
}

export const fix5mlCapColors = internalMutation({
    args: {},
    handler: async (ctx) => {
        // Find all 5ml cylinder product groups
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", "Cylinder"))
            .collect();

        const cyl5mlGroups = groups.filter((g) => g.capacityMl === 5);

        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const group of cyl5mlGroups) {
            const isCapProduct = group.displayName.includes("Bottle with Cap");
            const isSpray = group.displayName.includes("Fine Mist Spray");
            const isRollOn = group.displayName.includes("Roll-On");

            const products = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
                .collect();

            for (const product of products) {
                const sku = product.graceSku;
                const suffix = extractSuffix(sku);

                if (!suffix) {
                    errors.push(`No suffix extracted from ${sku}`);
                    skipped++;
                    continue;
                }

                const capColor = SKU_TO_CAP_COLOR[suffix];
                if (!capColor) {
                    errors.push(`Unknown suffix "${suffix}" from ${sku}`);
                    skipped++;
                    continue;
                }

                // Build the patch
                const patch: Record<string, unknown> = {
                    capColor,
                };

                // Fix "Bottle with Cap" products: set applicator and capHeight
                if (isCapProduct) {
                    patch.applicator = "Cap/Closure";
                    patch.capHeight = getCapHeight(sku);
                }

                // For spray products, also set capColor (used for overcap matching)
                // For roll-on products, capColor is used for cap matching

                await ctx.db.patch(product._id, patch);
                updated++;
            }
        }

        return {
            updated,
            skipped,
            errors: errors.slice(0, 20), // Limit error output
            groups: cyl5mlGroups.map((g) => `${g.displayName} (${g.slug})`),
        };
    },
});
