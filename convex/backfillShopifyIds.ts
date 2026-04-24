import { internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Backfill Shopify identifiers onto existing Convex records.
 *
 * Populates:
 *   - productGroups.shopifyProductId        (from Shopify product.id)
 *   - products.shopifyVariantId             (from Shopify variant.id)
 *   - products.shopifyInventoryItemId       (from Shopify variant.inventoryItem.id)
 *
 * Stored as full Shopify GIDs (e.g. "gid://shopify/ProductVariant/53343606505764")
 * to match the shape the webhook sync uses at convex/shopifySync.ts.
 *
 * NEVER patches catalog fields (family, color, capacity, itemName, etc). Only
 * the three Shopify-link fields above plus shopifyUpdatedAt.
 *
 * Driver: scripts/backfill_shopify_ids.mjs pulls from Shopify and calls these
 * mutations in batches.
 */

export const patchVariantShopifyIds = internalMutation({
    args: {
        patches: v.array(
            v.object({
                sku: v.string(),
                shopifyVariantId: v.string(),
                shopifyInventoryItemId: v.optional(v.string()),
            }),
        ),
    },
    handler: async (ctx, { patches }) => {
        const now = Date.now();
        let updated = 0;
        let notFound = 0;
        let alreadyLinked = 0;
        const notFoundSample: string[] = [];

        for (const p of patches) {
            let doc = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", p.sku))
                .first();
            if (!doc) {
                doc = await ctx.db
                    .query("products")
                    .withIndex("by_websiteSku", (q) => q.eq("websiteSku", p.sku))
                    .first();
            }
            if (!doc) {
                notFound++;
                if (notFoundSample.length < 20) notFoundSample.push(p.sku);
                continue;
            }

            if (doc.shopifyVariantId === p.shopifyVariantId) {
                alreadyLinked++;
                continue;
            }

            const patch: Record<string, unknown> = {
                shopifyVariantId: p.shopifyVariantId,
                shopifyUpdatedAt: now,
            };
            if (p.shopifyInventoryItemId) {
                patch.shopifyInventoryItemId = p.shopifyInventoryItemId;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await ctx.db.patch(doc._id, patch as any);
            updated++;
        }

        return { updated, alreadyLinked, notFound, notFoundSample };
    },
});

export const patchGroupShopifyIds = internalMutation({
    args: {
        patches: v.array(
            v.object({
                slug: v.string(),
                shopifyProductId: v.string(),
            }),
        ),
    },
    handler: async (ctx, { patches }) => {
        const now = Date.now();
        let updated = 0;
        let notFound = 0;
        let alreadyLinked = 0;
        const notFoundSample: string[] = [];

        for (const p of patches) {
            const group = await ctx.db
                .query("productGroups")
                .withIndex("by_slug", (q) => q.eq("slug", p.slug))
                .first();
            if (!group) {
                notFound++;
                if (notFoundSample.length < 20) notFoundSample.push(p.slug);
                continue;
            }

            if (group.shopifyProductId === p.shopifyProductId) {
                alreadyLinked++;
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await ctx.db.patch(group._id, {
                shopifyProductId: p.shopifyProductId,
                shopifyUpdatedAt: now,
            } as any);
            updated++;
        }

        return { updated, alreadyLinked, notFound, notFoundSample };
    },
});

type BatchResult = {
    updated: number;
    alreadyLinked: number;
    notFound: number;
    notFoundSample: string[];
};

export const applyVariantBatch = action({
    args: {
        patches: v.array(
            v.object({
                sku: v.string(),
                shopifyVariantId: v.string(),
                shopifyInventoryItemId: v.optional(v.string()),
            }),
        ),
        batchIndex: v.number(),
    },
    handler: async (
        ctx,
        args,
    ): Promise<BatchResult & { batchIndex: number }> => {
        const r: BatchResult = await ctx.runMutation(
            internal.backfillShopifyIds.patchVariantShopifyIds,
            { patches: args.patches },
        );
        return { batchIndex: args.batchIndex, ...r };
    },
});

export const applyGroupBatch = action({
    args: {
        patches: v.array(
            v.object({
                slug: v.string(),
                shopifyProductId: v.string(),
            }),
        ),
        batchIndex: v.number(),
    },
    handler: async (
        ctx,
        args,
    ): Promise<BatchResult & { batchIndex: number }> => {
        const r: BatchResult = await ctx.runMutation(
            internal.backfillShopifyIds.patchGroupShopifyIds,
            { patches: args.patches },
        );
        return { batchIndex: args.batchIndex, ...r };
    },
});
