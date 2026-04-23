import { internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Migration: Backfill physical specs (dimensions, weights, case qty, thread
 * size) from the Grace clean product reference library onto matched Convex
 * products. Non-destructive — only patches fields that are currently null or
 * empty.
 *
 * Source of reference data:
 *   /data/grace_products_clean.json   — 2,780 records, keyed by graceSku.
 *   Fields populated from source when Convex field is empty:
 *     - heightWithCap        (99.4% filled in source)
 *     - heightWithoutCap     (78.5% filled in source)
 *     - diameter             (99.4% filled in source)
 *     - bottleWeightG        (77.9% filled in source)
 *     - caseQuantity         (73.7% filled in source)
 *     - neckThreadSize       (95.9% filled in source)
 *     - capColor             (95.3% filled in source)
 *     - trimColor, capStyle, bottleCollection — if Convex null
 *
 * NOT backfilled from this source:
 *   - capHeight (0% filled) — derive from SKU pattern (see fix5mlCapColors.ts)
 *   - ballMaterial (0.1% filled) — derive from applicator value
 *   - prices (separate mutation — fillMissingComponentPrices)
 *
 * Matching: primary match on graceSku. Fallback match on websiteSku.
 *
 * Idempotent. Safe to re-run.
 *
 * Usage (2-step, matching seedProducts.ts pattern):
 *   1. Run: node scripts/backfill_physical_specs.mjs
 *      This reads data/grace_products_clean.json and calls
 *      backfillPhysicalSpecs:backfillBatch in chunks of 50.
 *   2. Or invoke the action directly with a chunked array:
 *      npx convex run backfillPhysicalSpecs:backfillBatch '{"records":[...],"batchIndex":0}'
 */

type BackfillRecord = {
    graceSku: string;
    websiteSku?: string | null;
    // Spec fields (any may be null in source; we only apply non-null values)
    capColor?: string | null;
    trimColor?: string | null;
    capStyle?: string | null;
    bottleCollection?: string | null;
    neckThreadSize?: string | null;
    heightWithCap?: string | null;
    heightWithoutCap?: string | null;
    diameter?: string | null;
    bottleWeightG?: number | null;
    caseQuantity?: number | null;
};

// The shape of each record we accept. Permissive — matches grace_products_clean.json.
// We v.any() inside and validate per-field in the handler to keep the contract loose.
export const backfillBatchMutation = internalMutation({
    args: {
        records: v.array(v.any()),
    },
    handler: async (ctx, args) => {
        const records = args.records as BackfillRecord[];

        let matched = 0;
        let unmatched = 0;
        let fieldsPatched = 0;
        const unmatchedSkus: string[] = [];

        // Helper: treat "", null, undefined as empty
        const isEmpty = (v: unknown): boolean =>
            v === null || v === undefined || v === "";

        // Helper: incoming value is usable
        const hasValue = (v: unknown): boolean =>
            v !== null && v !== undefined && v !== "";

        for (const rec of records) {
            if (!rec.graceSku) {
                unmatched++;
                continue;
            }

            // Primary match on graceSku
            let doc = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", rec.graceSku))
                .first();

            // Fallback on websiteSku
            if (!doc && rec.websiteSku) {
                doc = await ctx.db
                    .query("products")
                    .withIndex("by_websiteSku", (q) =>
                        q.eq("websiteSku", rec.websiteSku as string)
                    )
                    .first();
            }

            if (!doc) {
                unmatched++;
                if (unmatchedSkus.length < 50) unmatchedSkus.push(rec.graceSku);
                continue;
            }

            // Build a patch containing ONLY fields the Convex doc currently lacks
            const patch: Record<string, unknown> = {};

            // Each pair is [src-key-in-BackfillRecord, dest-key-in-products-doc].
            // Using plain strings keeps this simple; the handler casts to any
            // when calling ctx.db.patch.
            const candidates: Array<[keyof BackfillRecord, string]> = [
                ["capColor", "capColor"],
                ["trimColor", "trimColor"],
                ["capStyle", "capStyle"],
                ["bottleCollection", "bottleCollection"],
                ["neckThreadSize", "neckThreadSize"],
                ["heightWithCap", "heightWithCap"],
                ["heightWithoutCap", "heightWithoutCap"],
                ["diameter", "diameter"],
                ["bottleWeightG", "bottleWeightG"],
                ["caseQuantity", "caseQuantity"],
            ];

            const docRec = doc as unknown as Record<string, unknown>;
            for (const [srcKey, destKey] of candidates) {
                const incoming = rec[srcKey];
                const current = docRec[destKey];

                if (isEmpty(current) && hasValue(incoming)) {
                    if (['heightWithCap', 'heightWithoutCap', 'diameter', 'neckThreadSize'].includes(destKey)) {
                        patch[destKey] = String(incoming);
                    } else {
                        patch[destKey] = incoming;
                    }
                }
            }

            if (Object.keys(patch).length > 0) {
                // Keep an audit trail
                patch.importSource =
                    (doc as Record<string, unknown>).importSource ||
                    "backfill_physical_specs_20260422";

                await ctx.db.patch(doc._id, patch as any);
                fieldsPatched += Object.keys(patch).length - 1; // exclude importSource
            }
            matched++;
        }

        return {
            matched,
            unmatched,
            fieldsPatched,
            unmatchedSample: unmatchedSkus,
        };
    },
});

type BackfillBatchResult = {
    matched: number;
    unmatched: number;
    fieldsPatched: number;
    unmatchedSample: string[];
};

/**
 * Action wrapper — takes a chunk of records from the caller and forwards to
 * the mutation. Matches the seedProducts.ts seedBatch pattern.
 */
export const backfillBatch = action({
    args: {
        records: v.array(v.any()),
        batchIndex: v.number(),
    },
    handler: async (
        ctx,
        args,
    ): Promise<BackfillBatchResult & { batchIndex: number }> => {
        const result: BackfillBatchResult = await ctx.runMutation(
            internal.backfillPhysicalSpecs.backfillBatchMutation,
            { records: args.records }
        );
        return {
            batchIndex: args.batchIndex,
            ...result,
        };
    },
});

/**
 * Derive capHeight and ballMaterial from existing Convex data that the
 * clean-products source cannot provide. Runs as a pure self-patch, no
 * external input needed.
 *
 * Rules:
 *   capHeight:
 *     - applicator = "Cap/Closure" AND capStyle contains "Short" → "Short"
 *     - applicator = "Cap/Closure" AND capStyle contains "Tall"  → "Tall"
 *     - applicator = "Cap/Closure" AND capColor starts with "Short " → "Short"
 *     - Leather cap styles → "Leather"
 *   ballMaterial:
 *     - applicator = "Metal Roller Ball"   → "Metal"
 *     - applicator = "Plastic Roller Ball" → "Plastic"
 *
 * Idempotent. Only patches fields currently null.
 *
 * Run with: npx convex run backfillPhysicalSpecs:deriveCapHeightAndBallMaterial
 */
export const deriveCapHeightBatch = internalMutation({
    args: { cursor: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        const { page, continueCursor, isDone } = await ctx.db.query("products")
            .paginate({ cursor: args.cursor, numItems: 250 });

        let capHeightPatched = 0;
        let ballMaterialPatched = 0;

        for (const p of page) {
            const patch: Record<string, unknown> = {};

            // capHeight derivation
            if (p.capHeight == null && p.applicator === "Cap/Closure") {
                const style = (p.capStyle || "").toLowerCase();
                const color = (p.capColor || "").toLowerCase();

                if (style.includes("leather")) {
                    patch.capHeight = "Leather";
                } else if (style.includes("short") || color.startsWith("short ")) {
                    patch.capHeight = "Short";
                } else if (style.includes("tall") || color.endsWith(" tall")) {
                    patch.capHeight = "Tall";
                }
            }

            // ballMaterial derivation
            if (p.ballMaterial == null) {
                if (p.applicator === "Metal Roller Ball") {
                    patch.ballMaterial = "Metal";
                } else if (p.applicator === "Plastic Roller Ball") {
                    patch.ballMaterial = "Plastic";
                }
            }

            if (Object.keys(patch).length > 0) {
                await ctx.db.patch(p._id, patch);
                if (patch.capHeight) capHeightPatched++;
                if (patch.ballMaterial) ballMaterialPatched++;
            }
        }

        return {
            isDone,
            nextCursor: continueCursor,
            scanned: page.length,
            capHeightPatched,
            ballMaterialPatched,
        };
    },
});

export const deriveCapHeightAndBallMaterial = action({
    args: {},
    handler: async (ctx) => {
        let cursor: string | null = null;
        let totalScanned = 0;
        let totalCapPatched = 0;
        let totalBallPatched = 0;

        do {
            const res: any = await ctx.runMutation(internal.backfillPhysicalSpecs.deriveCapHeightBatch, { cursor });
            totalScanned += res.scanned;
            totalCapPatched += res.capHeightPatched;
            totalBallPatched += res.ballMaterialPatched;
            cursor = res.nextCursor;
            if (res.isDone) break;
        } while (cursor !== null);

        return {
            scanned: totalScanned,
            capHeightPatched: totalCapPatched,
            ballMaterialPatched: totalBallPatched,
        };
    },
});

/**
 * Diagnostic: return fill-rate stats for the key spec fields.
 * Rewritten to use pagination to avoid 16MB document size limit.
 *
 * Run with: npx convex run backfillPhysicalSpecs:fillRateReport
 */
export const fillRateBatch = internalMutation({
    args: { cursor: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        const { page, continueCursor, isDone } = await ctx.db.query("products")
            .paginate({ cursor: args.cursor, numItems: 250 });

        const fields = [
            "capColor", "trimColor", "capStyle", "capHeight", "ballMaterial",
            "neckThreadSize", "heightWithCap", "heightWithoutCap", "diameter",
            "bottleWeightG", "caseQuantity", "webPrice1pc", "bottleCollection",
            "itemDescription", "graceDescription",
        ] as const;

        const counts: Record<string, number> = {};
        for (const f of fields) { counts[f] = 0; }

        for (const p of page) {
            for (const f of fields) {
                const v = (p as Record<string, unknown>)[f];
                if (v !== null && v !== undefined && v !== "") {
                    counts[f]++;
                }
            }
        }

        return {
            isDone,
            nextCursor: continueCursor,
            scanned: page.length,
            counts,
        };
    },
});

export const fillRateReport = action({
    args: {},
    handler: async (ctx) => {
        let cursor: string | null = null;
        let totalScanned = 0;
        
        const fields = [
            "capColor", "trimColor", "capStyle", "capHeight", "ballMaterial",
            "neckThreadSize", "heightWithCap", "heightWithoutCap", "diameter",
            "bottleWeightG", "caseQuantity", "webPrice1pc", "bottleCollection",
            "itemDescription", "graceDescription",
        ];
        const totalCounts: Record<string, number> = {};
        for (const f of fields) { totalCounts[f] = 0; }

        do {
            const res: any = await ctx.runMutation(internal.backfillPhysicalSpecs.fillRateBatch, { cursor });
            totalScanned += res.scanned;
            for (const f of fields) {
                totalCounts[f] += res.counts[f] || 0;
            }
            cursor = res.nextCursor;
            if (res.isDone) break;
        } while (cursor !== null);

        const stats: Record<string, { filled: number; pct: string }> = {};
        for (const f of fields) {
            stats[f] = {
                filled: totalCounts[f],
                pct: totalScanned > 0 ? `${((100 * totalCounts[f]) / totalScanned).toFixed(1)}%` : "0%",
            };
        }

        return { total: totalScanned, stats };
    },
});
