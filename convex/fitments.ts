import { query } from "./_generated/server";
import { v } from "convex/values";

// Get all fitment mappings
export const listAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("fitments").collect();
    },
});

// Get fitments by the explicit thread size (e.g. "18-415" or "20-400")
export const getByThreadSize = query({
    args: { threadSize: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("fitments")
            .withIndex("by_threadSize", (q) => q.eq("threadSize", args.threadSize))
            .collect();
    },
});

// Get fitments directly by the bottle's canonical name
export const getByBottleName = query({
    args: { bottleName: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("fitments")
            .withIndex("by_bottleName", (q) => q.eq("bottleName", args.bottleName))
            .first();
    },
});
