import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public mutation called by Madison Studio's publish edge function after
 * uploading a per-group hero image to Sanity. Patches productGroups.heroImageUrl
 * for the matching slug.
 */
export const setHeroImageUrl = mutation({
    args: {
        slug: v.string(),
        heroImageUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const group = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();
        if (!group) {
            return { success: false, slug: args.slug, error: "not_found" as const };
        }
        await ctx.db.patch(group._id, { heroImageUrl: args.heroImageUrl });
        return { success: true, slug: args.slug };
    },
});
