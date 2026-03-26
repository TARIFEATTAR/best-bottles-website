import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Sync Paper Doll layer image URLs from Sanity (or render pipeline) onto a product row.
 * Looks up by graceSku (canonical SKU in this codebase).
 */
export const updateProductLayers = mutation({
    args: {
        graceSku: v.string(),
        bodyImageUrl: v.optional(v.string()),
        fitmentImageUrl: v.optional(v.string()),
        capImageUrl: v.optional(v.string()),
        rollerImageUrl: v.optional(v.string()),
        layerOrder: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const product = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", args.graceSku))
            .first();

        if (!product) {
            throw new Error(`Product not found for graceSku: ${args.graceSku}`);
        }

        const patch: Record<string, unknown> = {
            paperDollReady: true,
            paperDollProcessedAt: Date.now(),
        };
        if (args.bodyImageUrl !== undefined) patch.paperDollBodyUrl = args.bodyImageUrl;
        if (args.fitmentImageUrl !== undefined) patch.paperDollFitmentUrl = args.fitmentImageUrl;
        if (args.capImageUrl !== undefined) patch.paperDollCapUrl = args.capImageUrl;
        if (args.rollerImageUrl !== undefined) patch.paperDollRollerUrl = args.rollerImageUrl;
        if (args.layerOrder !== undefined) patch.paperDollLayerOrder = args.layerOrder;

        await ctx.db.patch(product._id, patch);

        return { ok: true, productId: product._id };
    },
});

/**
 * Link a product group to a Paper Doll family (e.g. CYL-9ML).
 * Sets paperDollFamilyKey on the productGroups row so the PDP renders composites.
 */
export const linkGroupToFamily = mutation({
    args: {
        groupId: v.id("productGroups"),
        familyKey: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.groupId, { paperDollFamilyKey: args.familyKey });
        return { ok: true };
    },
});

/**
 * Batch-link all product groups matching a family + capacityMl to a paper doll family key.
 */
export const linkFamilyGroups = mutation({
    args: {
        family: v.string(),
        capacityMl: v.number(),
        familyKey: v.string(),
        threadFilter: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();

        let count = 0;
        for (const g of groups) {
            if (g.capacityMl !== args.capacityMl) continue;
            if (args.threadFilter && g.neckThreadSize !== args.threadFilter) continue;
            await ctx.db.patch(g._id, { paperDollFamilyKey: args.familyKey });
            count++;
        }
        return { ok: true, count };
    },
});
