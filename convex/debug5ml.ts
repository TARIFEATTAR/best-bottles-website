import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Diagnostic query: show all 5ml cylinder product groups and their variants' cap data.
 * Run with: npx convex run debug5ml:audit5mlCaps
 */
export const audit5mlCaps = query({
    args: {},
    handler: async (ctx) => {
        // Find all 5ml cylinder product groups
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", "Cylinder"))
            .collect();

        const cyl5mlGroups = groups.filter((g) => g.capacityMl === 5);

        const results = [];
        for (const g of cyl5mlGroups) {
            const products = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", g._id))
                .collect();

            results.push({
                slug: g.slug,
                displayName: g.displayName,
                color: g.color,
                paperDollFamilyKey: g.paperDollFamilyKey,
                variantCount: products.length,
                variants: products.map((p) => ({
                    graceSku: p.graceSku,
                    applicator: p.applicator,
                    capColor: p.capColor,
                    capHeight: p.capHeight,
                    capStyle: p.capStyle,
                    trimColor: p.trimColor,
                    itemName: p.itemName?.substring(0, 80),
                })),
            });
        }

        return results;
    },
});
