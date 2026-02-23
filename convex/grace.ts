import { query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ----------------------------------------------------------------------------
// GRACE AI SCAFFOLDING & ABILITIES
// These internal queries are designed to be explicitly called by the LLM
// as "function tools" to interact with the database.
// ----------------------------------------------------------------------------

/**
 * AI Tool: Search Catalog
 * Grace uses this to find specific bottles or closures based on a user's text prompt.
 * It uses the native full-text search index we built on the products table.
 */
export const searchCatalog = query({
    args: {
        searchTerm: v.string(),
        categoryLimit: v.optional(v.string()),
        familyLimit: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        let q = ctx.db.query("products").withSearchIndex("search_itemName", (q) =>
            q.search("itemName", args.searchTerm)
        );

        // Apply optional AI filters if Grace decides they are relevant
        if (args.categoryLimit) {
            q = q.filter((q) => q.eq(q.field("category"), args.categoryLimit));
        }
        if (args.familyLimit) {
            q = q.filter((q) => q.eq(q.field("family"), args.familyLimit));
        }

        // Return the top 10 most relevant hits to preserve LLM token context limits
        return await q.take(10);
    }
});

/**
 * AI Tool: Check Compatibility
 * Grace uses this to confirm if a specific bottle matches a specific closure 
 * based on Thread Size and Family rules.
 */
export const checkCompatibility = query({
    args: { threadSize: v.string() },
    handler: async (ctx, args) => {
        // Grace passes the thread size (e.g., "18-415") and gets back the exact 
        // matrix of compatible families and closures.
        return await ctx.db
            .query("fitments")
            .withIndex("by_threadSize", (q) => q.eq("threadSize", args.threadSize))
            .collect();
    }
});

/**
 * Grace AI Agent Core Shell
 * This is the primary Action where the OpenAI/Anthropic SDK will eventually live.
 * Frontend chat components call this directly.
 */
export const askGrace = action({
    // Accept the user's chat message and history
    args: { message: v.string() },
    handler: async (ctx, args) => {
        // In the future:
        // 1. Send `args.message` to OpenAI
        // 2. OpenAI decides to call `api.grace.searchCatalog` or `api.grace.checkCompatibility`
        // 3. We run `ctx.runQuery(api.grace.searchCatalog, { ... })`
        // 4. We feed the DB results back into OpenAI
        // 5. OpenAI streams the final human-readable response back to the user.

        // Simulated Placeholder Response
        return `Beep boop. I am the scaffolding for Grace AI. You asked: "${args.message}". In the next phase, I will wire an LLM in here to process this request using the tools we just built!`;
    }
});
