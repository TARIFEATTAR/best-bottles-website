import { internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Override caseWeightG, bottleWeightG, and caseQuantity from the
 * corrected-info CSV (supplied 2026-04-23). These are authoritative
 * corrections on top of the v8.3 master import — overwrite behavior,
 * not fill-if-empty.
 *
 * Source: data/case_weight_corrections.json (extracted from
 *   "Bottle weight and case quantity - corrected info to upload" CSV)
 *
 * Match on websiteSku (CSV's ID column matches websiteSku format).
 *
 * Run via driver: node scripts/apply_case_weight_corrections.mjs
 */

type Correction = {
    websiteSku: string;
    caseWeightG: number | null;
    bottleWeightG: number | null;
    caseQuantity: number | null;
};

const IMPORT_SOURCE = "case_weight_corrections_20260423";

export const applyBatchMutation = internalMutation({
    args: { records: v.array(v.any()) },
    handler: async (ctx, args) => {
        const records = args.records as Correction[];
        let matched = 0;
        let unmatched = 0;
        let overwritten = 0;
        const counts: Record<string, number> = {
            caseWeightG: 0,
            bottleWeightG: 0,
            caseQuantity: 0,
        };
        const unmatchedSkus: string[] = [];

        for (const rec of records) {
            if (!rec.websiteSku) {
                unmatched++;
                continue;
            }

            let doc = await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) =>
                    q.eq("websiteSku", rec.websiteSku),
                )
                .first();

            // Fallback: try graceSku (some CSV IDs match graceSku instead)
            if (!doc) {
                doc = await ctx.db
                    .query("products")
                    .withIndex("by_graceSku", (q) =>
                        q.eq("graceSku", rec.websiteSku),
                    )
                    .first();
            }

            if (!doc) {
                unmatched++;
                if (unmatchedSkus.length < 50) unmatchedSkus.push(rec.websiteSku);
                continue;
            }

            const patch: Record<string, unknown> = {};
            if (rec.caseWeightG !== null && Number.isFinite(rec.caseWeightG)) {
                patch.caseWeightG = rec.caseWeightG;
                counts.caseWeightG++;
            }
            if (rec.bottleWeightG !== null && Number.isFinite(rec.bottleWeightG)) {
                patch.bottleWeightG = rec.bottleWeightG;
                counts.bottleWeightG++;
            }
            if (rec.caseQuantity !== null && Number.isFinite(rec.caseQuantity)) {
                patch.caseQuantity = rec.caseQuantity;
                counts.caseQuantity++;
            }

            if (Object.keys(patch).length > 0) {
                patch.importSource = IMPORT_SOURCE;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await ctx.db.patch(doc._id, patch as any);
                overwritten += Object.keys(patch).length - 1;
            }
            matched++;
        }

        return { matched, unmatched, overwritten, counts, unmatchedSample: unmatchedSkus };
    },
});

export const applyBatch = action({
    args: {
        records: v.array(v.any()),
        batchIndex: v.number(),
    },
    handler: async (ctx, args) => {
        const r = await ctx.runMutation(
            internal.applyCaseWeightCorrections.applyBatchMutation,
            { records: args.records },
        );
        return { batchIndex: args.batchIndex, ...r };
    },
});
