import { internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Grace Knowledge Enrichment: patch Convex products from Master v8.3.
 *
 * Source: data/master_v8.3_products.json (extracted from
 *   docs/BestBottles_Master_v8.3_Verification.xlsx via scripts/extract_master_v83.py)
 *
 * Why: the existing `grace_products_clean.json` backfill source is a derivative
 * and is already mirrored in Convex. The v8.3 master sheet contains richer
 * metadata that Grace needs — particularly useCaseDescription, capStyle at high
 * fill rate, and dataGrade.
 *
 * Fields patched (non-destructive — only when Convex field is empty):
 *   capStyle, capColor, caseQuantity, bottleWeightG, caseWeightG (NEW),
 *   heightWithCap, heightWithoutCap, diameter, useCaseDescription (NEW),
 *   dataGrade, bottleCollection
 *
 * Matching: graceSku primary, websiteSku fallback.
 * Idempotent. Safe to re-run.
 *
 * Run via driver:
 *   node scripts/patch_from_master_v83.mjs
 *
 * Or run a single batch directly (for debugging):
 *   npx convex run patchFromMasterV83:patchBatch '{"records":[...],"batchIndex":0}'
 */

type MasterRecord = {
    graceSku: string | null;
    websiteSku: string | null;
    capStyle?: string | null;
    capColor?: string | null;
    caseQuantity?: number | null;
    bottleWeightG?: number | null;
    caseWeightG?: number | null;
    heightWithCap?: string | null;
    heightWithoutCap?: string | null;
    diameter?: string | null;
    useCaseDescription?: string | null;
    dataGrade?: string | null;
    bottleCollection?: string | null;
};

const IMPORT_SOURCE = "master_v8.3_enrichment_20260423";

export const patchBatchMutation = internalMutation({
    args: {
        records: v.array(v.any()),
    },
    handler: async (ctx, args) => {
        const records = args.records as MasterRecord[];

        let matched = 0;
        let unmatched = 0;
        let fieldsPatched = 0;
        const unmatchedSkus: string[] = [];
        const fieldCounts: Record<string, number> = {};

        const isEmpty = (v: unknown): boolean =>
            v === null || v === undefined || v === "";

        const hasValue = (v: unknown): boolean =>
            v !== null && v !== undefined && v !== "";

        for (const rec of records) {
            const graceSku = rec.graceSku;
            const websiteSku = rec.websiteSku;

            if (!graceSku && !websiteSku) {
                unmatched++;
                continue;
            }

            // Primary match on graceSku
            let doc = null;
            if (graceSku) {
                doc = await ctx.db
                    .query("products")
                    .withIndex("by_graceSku", (q) =>
                        q.eq("graceSku", graceSku),
                    )
                    .first();
            }

            // Fallback on websiteSku
            if (!doc && websiteSku) {
                doc = await ctx.db
                    .query("products")
                    .withIndex("by_websiteSku", (q) =>
                        q.eq("websiteSku", websiteSku),
                    )
                    .first();
            }

            if (!doc) {
                unmatched++;
                if (unmatchedSkus.length < 50) {
                    unmatchedSkus.push(graceSku ?? websiteSku ?? "");
                }
                continue;
            }

            // String fields: always stored as string
            const stringFields: Array<keyof MasterRecord> = [
                "capStyle",
                "capColor",
                "heightWithCap",
                "heightWithoutCap",
                "diameter",
                "useCaseDescription",
                "dataGrade",
                "bottleCollection",
            ];

            // Number fields: always stored as number
            const numberFields: Array<keyof MasterRecord> = [
                "caseQuantity",
                "bottleWeightG",
                "caseWeightG",
            ];

            const patch: Record<string, unknown> = {};
            const docRec = doc as unknown as Record<string, unknown>;

            for (const field of stringFields) {
                const incoming = rec[field];
                const current = docRec[field as string];
                if (isEmpty(current) && hasValue(incoming)) {
                    patch[field as string] = String(incoming);
                    fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
                }
            }

            for (const field of numberFields) {
                const incoming = rec[field];
                const current = docRec[field as string];
                if (
                    isEmpty(current) &&
                    hasValue(incoming) &&
                    typeof incoming === "number" &&
                    Number.isFinite(incoming)
                ) {
                    patch[field as string] = incoming;
                    fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
                }
            }

            if (Object.keys(patch).length > 0) {
                patch.importSource =
                    (doc as Record<string, unknown>).importSource ||
                    IMPORT_SOURCE;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await ctx.db.patch(doc._id, patch as any);
                fieldsPatched += Object.keys(patch).length - 1; // exclude importSource
            }
            matched++;
        }

        return {
            matched,
            unmatched,
            fieldsPatched,
            fieldCounts,
            unmatchedSample: unmatchedSkus,
        };
    },
});

type PatchBatchResult = {
    matched: number;
    unmatched: number;
    fieldsPatched: number;
    fieldCounts: Record<string, number>;
    unmatchedSample: string[];
};

/**
 * Action wrapper for the Node driver.
 */
export const patchBatch = action({
    args: {
        records: v.array(v.any()),
        batchIndex: v.number(),
    },
    handler: async (
        ctx,
        args,
    ): Promise<PatchBatchResult & { batchIndex: number }> => {
        const result: PatchBatchResult = await ctx.runMutation(
            internal.patchFromMasterV83.patchBatchMutation,
            { records: args.records },
        );
        return {
            batchIndex: args.batchIndex,
            ...result,
        };
    },
});

/**
 * Fill-rate report specifically for the enrichment fields.
 * Paginated to stay under Convex's per-function byte limit — `useCaseDescription`
 * is long-form text and a full-table collect exceeds 16MB.
 *
 * Run with: npx convex run patchFromMasterV83:enrichmentFillRates
 */
export const enrichmentFillRatesPage = internalMutation({
    args: {
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        const page = await ctx.db
            .query("products")
            .paginate({ numItems: 300, cursor: args.cursor });

        const fields = [
            "capStyle",
            "capColor",
            "caseQuantity",
            "bottleWeightG",
            "caseWeightG",
            "heightWithCap",
            "heightWithoutCap",
            "diameter",
            "useCaseDescription",
            "dataGrade",
            "bottleCollection",
        ];

        const counts: Record<string, number> = {};
        for (const f of fields) counts[f] = 0;
        let enrichedByThisMigration = 0;

        for (const p of page.page) {
            const rec = p as Record<string, unknown>;
            for (const f of fields) {
                const v = rec[f];
                if (v !== null && v !== undefined && v !== "") counts[f]++;
            }
            if (rec.importSource === IMPORT_SOURCE) enrichedByThisMigration++;
        }

        return {
            counts,
            enrichedByThisMigration,
            pageSize: page.page.length,
            isDone: page.isDone,
            continueCursor: page.continueCursor,
        };
    },
});

export const enrichmentFillRates = action({
    args: {},
    handler: async (ctx): Promise<{
        total: number;
        enrichedByThisMigration: number;
        stats: Record<string, { filled: number; pct: string }>;
    }> => {
        const fields = [
            "capStyle",
            "capColor",
            "caseQuantity",
            "bottleWeightG",
            "caseWeightG",
            "heightWithCap",
            "heightWithoutCap",
            "diameter",
            "useCaseDescription",
            "dataGrade",
            "bottleCollection",
        ];

        const totals: Record<string, number> = {};
        for (const f of fields) totals[f] = 0;
        let total = 0;
        let enriched = 0;
        let cursor: string | null = null;

        while (true) {
            const page: {
                counts: Record<string, number>;
                enrichedByThisMigration: number;
                pageSize: number;
                isDone: boolean;
                continueCursor: string;
            } = await ctx.runMutation(
                internal.patchFromMasterV83.enrichmentFillRatesPage,
                { cursor },
            );
            for (const f of fields) totals[f] += page.counts[f] ?? 0;
            total += page.pageSize;
            enriched += page.enrichedByThisMigration;
            if (page.isDone) break;
            cursor = page.continueCursor;
        }

        const stats: Record<string, { filled: number; pct: string }> = {};
        for (const f of fields) {
            stats[f] = {
                filled: totals[f],
                pct: total === 0 ? "0.0%" : `${((100 * totals[f]) / total).toFixed(1)}%`,
            };
        }

        return {
            total,
            enrichedByThisMigration: enriched,
            stats,
        };
    },
});
