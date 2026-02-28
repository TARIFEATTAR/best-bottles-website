import { mutation, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT SEEDER
// Seeds products from grace_products_clean.json into the Convex products table.
// Usage: npx convex run seedProducts:seedFromData
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal mutation that inserts a batch of products.
 * Called by the seedFromData action in chunks to avoid size limits.
 */
export const insertBatch = internalMutation({
    args: {
        products: v.array(v.object({
            productId: v.optional(v.union(v.string(), v.null())),
            websiteSku: v.string(),
            graceSku: v.string(),
            category: v.string(),
            family: v.union(v.string(), v.null()),
            shape: v.union(v.string(), v.null()),
            color: v.union(v.string(), v.null()),
            capacity: v.union(v.string(), v.null()),
            capacityMl: v.union(v.number(), v.null()),
            capacityOz: v.union(v.number(), v.null()),
            applicator: v.union(
                v.literal("Metal Roller"),
                v.literal("Plastic Roller"),
                v.literal("Fine Mist Sprayer"),
                v.literal("Perfume Spray Pump"),
                v.literal("Atomizer"),
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
            capColor: v.union(v.string(), v.null()),
            trimColor: v.union(v.string(), v.null()),
            capStyle: v.union(v.string(), v.null()),
            ballMaterial: v.optional(v.union(v.string(), v.null())),
            neckThreadSize: v.union(v.string(), v.null()),
            heightWithCap: v.union(v.string(), v.null()),
            heightWithoutCap: v.union(v.string(), v.null()),
            diameter: v.union(v.string(), v.null()),
            bottleWeightG: v.union(v.number(), v.null()),
            caseQuantity: v.union(v.number(), v.null()),
            qbPrice: v.union(v.number(), v.null()),
            webPrice1pc: v.union(v.number(), v.null()),
            webPrice10pc: v.union(v.number(), v.null()),
            webPrice12pc: v.union(v.number(), v.null()),
            stockStatus: v.union(v.string(), v.null()),
            itemName: v.string(),
            itemDescription: v.union(v.string(), v.null()),
            imageUrl: v.optional(v.union(v.string(), v.null())),
            productUrl: v.union(v.string(), v.null()),
            dataGrade: v.union(v.string(), v.null()),
            bottleCollection: v.union(v.string(), v.null()),
            fitmentStatus: v.union(v.string(), v.null()),
            components: v.any(),
            graceDescription: v.union(v.string(), v.null()),
            verified: v.boolean(),
            importSource: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        for (const product of args.products) {
            await ctx.db.insert("products", product);
        }
        return { inserted: args.products.length };
    },
});

/**
 * Clear 500 products from the table at a time. Run multiple times until 0.
 */
export const clearAll = mutation({
    args: {},
    handler: async (ctx) => {
        const batch = await ctx.db.query("products").take(50);
        for (const product of batch) {
            await ctx.db.delete(product._id);
        }
        return { deleted: batch.length };
    },
});

/**
 * Main seeder action — call this from the CLI.
 * Reads the full product array passed as an argument and seeds in batches of 50.
 * 
 * Usage:
 *   node scripts/seed.mjs
 */
export const seedBatch = action({
    args: {
        products: v.array(v.any()),
        batchIndex: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.runMutation(internal.seedProducts.insertBatch, {
            products: args.products as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        });
        return {
            batchIndex: args.batchIndex,
            inserted: args.products.length,
        };
    },
});

/**
 * Seed fitment rules in a single batch.
 */
export const insertFitments = internalMutation({
    args: {
        fitments: v.array(v.object({
            threadSize: v.string(),
            bottleName: v.string(),
            bottleCode: v.union(v.string(), v.null()),
            familyHint: v.union(v.string(), v.null()),
            capacityMl: v.union(v.number(), v.null()),
            components: v.any(),
        })),
    },
    handler: async (ctx, args) => {
        for (const fitment of args.fitments) {
            await ctx.db.insert("fitments", fitment);
        }
        return { inserted: args.fitments.length };
    },
});

export const clearFitments = internalMutation({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query("fitments").collect();
        for (const item of all) {
            await ctx.db.delete(item._id);
        }
        return { deleted: all.length };
    },
});

export const seedFitmentBatch = action({
    args: {
        fitments: v.array(v.any()),
        batchIndex: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.runMutation(internal.seedProducts.insertFitments, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fitments: args.fitments as any,
        });
        return {
            batchIndex: args.batchIndex,
            inserted: args.fitments.length,
        };
    },
});
