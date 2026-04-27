import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Grace AI uploads — user-supplied files (reference images for Pattern H,
 * brand logos for Pattern I).
 *
 * Two-step flow:
 *   1. Client calls `generateUploadUrl` → gets a one-shot Convex storage URL.
 *   2. Client POSTs the file to that URL → receives a `storageId`.
 *   3. Client calls `recordUpload({ blobId, mime, size, ownerKey, kind })`
 *      to register the upload in `graceUploads`.
 *
 * `getUrl(blobId)` returns the stable serving URL for the renderer
 * (Patterns H and I both need this).
 */

const MAX_BYTES = 25 * 1024 * 1024; // PRD: 25MB cap

const ACCEPTED_MIMES = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
    "application/postscript", // .ai
    "application/illustrator", // some clients
    "image/svg+xml",
]);

export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

export const recordUpload = mutation({
    args: {
        blobId: v.string(),
        mime: v.string(),
        size: v.number(),
        ownerKey: v.string(),
        kind: v.union(v.literal("reference"), v.literal("logo")),
    },
    handler: async (ctx, args) => {
        if (args.size > MAX_BYTES) {
            throw new Error(`File exceeds ${MAX_BYTES / (1024 * 1024)}MB limit.`);
        }
        if (!ACCEPTED_MIMES.has(args.mime.toLowerCase())) {
            throw new Error(`Unsupported file type: ${args.mime}`);
        }
        const id = await ctx.db.insert("graceUploads", {
            blobId: args.blobId,
            mime: args.mime,
            size: args.size,
            ownerKey: args.ownerKey,
            kind: args.kind,
            createdAt: Date.now(),
        });
        const url = await ctx.storage.getUrl(args.blobId);
        return { id, url };
    },
});

export const getUrl = query({
    args: { blobId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.blobId);
    },
});

export const listByOwner = query({
    args: { ownerKey: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("graceUploads")
            .withIndex("by_owner", (q) => q.eq("ownerKey", args.ownerKey))
            .order("desc")
            .take(20);
    },
});
