import { query } from "./_generated/server";
import { v } from "convex/values";

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
