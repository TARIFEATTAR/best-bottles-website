import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Grace AI shortlists — saved product collections, optionally shareable
 * via opaque token.
 *
 * `ownerKey` scopes shortlists to a user — either an anonymous localStorage
 * UUID (`getAnonOwnerKey()`) or a `clerkOrgId` for authenticated B2B accounts.
 * Public share URLs only expose the `shareToken`; never the ownerKey.
 *
 * Pattern J (shortlist build + share artifact) consumes these.
 */

function genShareToken(): string {
    // Opaque, URL-safe, time-prefixed for sortability. 12-char base36.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const ITEM_VALIDATOR = v.object({
    graceSku: v.string(),
    addedAt: v.number(),
    notes: v.optional(v.string()),
});

export const create = mutation({
    args: {
        ownerKey: v.string(),
        name: v.optional(v.string()),
        items: v.array(ITEM_VALIDATOR),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const id = await ctx.db.insert("graceShortlists", {
            ownerKey: args.ownerKey,
            name: args.name,
            items: args.items,
            createdAt: now,
            updatedAt: now,
        });
        return { id };
    },
});

export const addItem = mutation({
    args: {
        shortlistId: v.id("graceShortlists"),
        graceSku: v.string(),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const doc = await ctx.db.get(args.shortlistId);
        if (!doc) throw new Error("Shortlist not found");
        if (doc.items.some((i: { graceSku: string }) => i.graceSku === args.graceSku)) {
            return { added: false }; // already in the shortlist
        }
        await ctx.db.patch(args.shortlistId, {
            items: [...doc.items, { graceSku: args.graceSku, addedAt: Date.now(), notes: args.notes }],
            updatedAt: Date.now(),
        });
        return { added: true };
    },
});

export const removeItem = mutation({
    args: {
        shortlistId: v.id("graceShortlists"),
        graceSku: v.string(),
    },
    handler: async (ctx, args) => {
        const doc = await ctx.db.get(args.shortlistId);
        if (!doc) throw new Error("Shortlist not found");
        await ctx.db.patch(args.shortlistId, {
            items: doc.items.filter((i: { graceSku: string }) => i.graceSku !== args.graceSku),
            updatedAt: Date.now(),
        });
    },
});

export const getByOwner = query({
    args: { ownerKey: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("graceShortlists")
            .withIndex("by_owner", (q) => q.eq("ownerKey", args.ownerKey))
            .collect();
    },
});

export const getByToken = query({
    args: { shareToken: v.string() },
    handler: async (ctx, args) => {
        const docs = await ctx.db
            .query("graceShortlists")
            .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
            .collect();
        return docs[0] ?? null;
    },
});

/** Mints a share token for a shortlist (idempotent — returns existing if set). */
export const mintShareToken = mutation({
    args: { shortlistId: v.id("graceShortlists") },
    handler: async (ctx, args) => {
        const doc = await ctx.db.get(args.shortlistId);
        if (!doc) throw new Error("Shortlist not found");
        if (doc.shareToken) return { shareToken: doc.shareToken };
        const shareToken = genShareToken();
        await ctx.db.patch(args.shortlistId, { shareToken, updatedAt: Date.now() });
        return { shareToken };
    },
});
