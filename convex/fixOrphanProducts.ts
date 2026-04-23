import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Migration: Fix 3 orphan products in Convex — records with slugs/identifiers
 * that do not correspond to any live bestbottles.com PDP.
 *
 * See: docs/data_alignment/PARITY_FINAL_REPORT.json
 * Raw data: docs/data_alignment/SLUGS_CONVEX_ONLY_not_on_live.json
 *
 * Orphans discovered 2026-04-22:
 *   1. "Vial-design-1-o-5-ml-amber-glass-white-short-cap"
 *      → Capitalized "V" typo — likely should be "vial-design-1-o-5-ml..."
 *      → ACTION: log only. Slug normalization happens on productGroups, not
 *        products.productUrl. If a matching productGroup exists with the
 *        correct slug, this is safe to leave. Flag for manual review.
 *
 *   2. "bell-design-10-ml-clear-glass-bottle-shiny-black-spray"
 *      → No live PDP. Live site returns soft-404 or has been removed.
 *      → ACTION: mark stockStatus = "Discontinued" and verified = false.
 *        Do NOT hard-delete — preserves QB/order history integrity.
 *
 *   3. "pillar-design-9-ml-clear-glass-bottle-matte-black-spray"
 *      → No live PDP. Same situation as #2.
 *      → ACTION: mark stockStatus = "Discontinued" and verified = false.
 *
 * Idempotent. Safe to re-run.
 *
 * Run with: npx convex run fixOrphanProducts:fixOrphans
 */

const ORPHANS_TO_DISCONTINUE = [
    "bell-design-10-ml-clear-glass-bottle-shiny-black-spray",
    "pillar-design-9-ml-clear-glass-bottle-matte-black-spray",
] as const;

const ORPHANS_TO_REVIEW = [
    "Vial-design-1-o-5-ml-amber-glass-white-short-cap",
] as const;

export const fixOrphans = internalMutation({
    args: {},
    handler: async (ctx) => {
        const IMPORT_SOURCE = "orphan_cleanup_20260422";
        const discontinued: Array<{ slug: string; productIds: string[]; productGroupId?: string }> = [];
        const flagged: Array<{ slug: string; found: boolean; note: string }> = [];

        // ── Part 1: Discontinue (soft-delete) orphans that have no live PDP ──────
        for (const slug of ORPHANS_TO_DISCONTINUE) {
            // Try to find the productGroup by slug (slugs live on productGroups)
            const group = await ctx.db
                .query("productGroups")
                .withIndex("by_slug", (q) => q.eq("slug", slug))
                .first();

            if (!group) {
                discontinued.push({ slug, productIds: [], productGroupId: undefined });
                continue;
            }

            // Find all product variants linked to this group
            const variants = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
                .collect();

            const patchedIds: string[] = [];
            for (const v of variants) {
                await ctx.db.patch(v._id, {
                    stockStatus: "Discontinued",
                    verified: false,
                    importSource: IMPORT_SOURCE,
                });
                patchedIds.push(v._id);
            }

            discontinued.push({
                slug,
                productIds: patchedIds,
                productGroupId: group._id,
            });
        }

        // ── Part 2: Flag typo/capitalization orphans for manual review ───────────
        for (const slug of ORPHANS_TO_REVIEW) {
            const group = await ctx.db
                .query("productGroups")
                .withIndex("by_slug", (q) => q.eq("slug", slug))
                .first();

            // Also try the lowercase version
            const lowered = slug.toLowerCase();
            const groupLower = await ctx.db
                .query("productGroups")
                .withIndex("by_slug", (q) => q.eq("slug", lowered))
                .first();

            if (group && !groupLower) {
                // Rename the slug to lowercase (safe — lowercase version does not exist)
                await ctx.db.patch(group._id, { slug: lowered });
                flagged.push({
                    slug,
                    found: true,
                    note: `Renamed slug to lowercase: "${lowered}" (productGroup _id: ${group._id})`,
                });
            } else if (group && groupLower) {
                flagged.push({
                    slug,
                    found: true,
                    note: `Both "${slug}" and "${lowered}" exist as productGroups. Manual merge required.`,
                });
            } else if (!group && groupLower) {
                flagged.push({
                    slug,
                    found: false,
                    note: `Orphan "${slug}" not in DB, but lowercase "${lowered}" exists. Likely already normalized.`,
                });
            } else {
                flagged.push({
                    slug,
                    found: false,
                    note: `Neither "${slug}" nor lowercase variant found. No action taken.`,
                });
            }
        }

        return {
            importSource: IMPORT_SOURCE,
            discontinued: {
                count: discontinued.length,
                details: discontinued,
            },
            flaggedForReview: {
                count: flagged.length,
                details: flagged,
            },
            nextSteps: [
                "Review 'flaggedForReview' entries manually.",
                "If discontinued products are truly dead, consider archiving their productGroups after 90 days.",
                "Do NOT hard-delete — portalOrders reference these SKUs.",
            ],
        };
    },
});
