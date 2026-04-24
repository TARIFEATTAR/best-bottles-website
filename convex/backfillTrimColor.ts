import { internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Backfill `trimColor` on Vintage Bulb Sprayer (ASP) and Vintage Bulb
 * Sprayer with Tassel (AST) products.
 *
 * Why: for these applicators `capColor` stores the BULB/TASSEL color, but
 * the visible metal collar is a separate color. The detailed color is in
 * itemName (e.g. "…with Red vintage style bulb sprayer with tassel with
 * shiny silver collar cap"). We extract the collar color from itemName
 * and store it in the pre-existing `trimColor` field.
 *
 * Idempotent — only patches rows where trimColor is currently null.
 *
 * Usage:
 *   Dry-run preview:  npx convex run backfillTrimColor:backfillTrimColor '{"dryRun":true}'
 *   Apply:            npx convex run backfillTrimColor:backfillTrimColor
 */

// Match the 1-2 words immediately before "collar cap" — that's the collar color.
// Examples: "shiny silver collar cap" -> "shiny silver"; "gold collar cap" -> "gold".
const TRIM_RX = /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+collar\s+cap\b/i;

const FINISH_WORDS = new Set(["shiny", "matte", "antique", "vintage"]);
const COLOR_WORDS = new Set([
    "gold", "silver", "black", "white", "copper", "bronze",
    "brass", "red", "blue", "green", "pink", "ivory", "lavender",
    "purple", "grey", "gray",
]);

export function extractTrimColor(itemName: string | null | undefined): string | null {
    if (!itemName) return null;
    const m = TRIM_RX.exec(itemName);
    if (!m) return null;
    const raw = m[1].trim().toLowerCase();
    if (!raw) return null;
    const tokens = raw.split(/\s+/).filter(Boolean);
    // Valid shapes: [color] or [finish, color]
    let finish: string | null = null;
    let color: string | null = null;
    if (tokens.length === 1 && COLOR_WORDS.has(tokens[0])) {
        color = tokens[0];
    } else if (tokens.length === 2 && FINISH_WORDS.has(tokens[0]) && COLOR_WORDS.has(tokens[1])) {
        finish = tokens[0];
        color = tokens[1];
    } else if (tokens.length === 2 && COLOR_WORDS.has(tokens[0]) && COLOR_WORDS.has(tokens[1])) {
        // Compound color like "ivory gold" — keep both.
        color = `${tokens[0]} ${tokens[1]}`;
    }
    if (!color) return null;
    const parts = finish
        ? [finish.charAt(0).toUpperCase() + finish.slice(1),
           color.split(" ").map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ")]
        : [color.split(" ").map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ")];
    const titled = parts.join(" ");
    return titled.length > 40 ? null : titled;
}

const TARGET_APPLICATORS = new Set([
    "Vintage Bulb Sprayer",
    "Vintage Bulb Sprayer with Tassel",
    "Antique Bulb Sprayer",
    "Antique Bulb Sprayer with Tassel",
]);

export const backfillTrimColorBatch = internalMutation({
    args: {
        cursor: v.union(v.string(), v.null()),
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const dryRun = !!args.dryRun;
        const { page, continueCursor, isDone } = await ctx.db
            .query("products")
            .paginate({ cursor: args.cursor, numItems: 250 });

        let scanned = 0;
        let eligible = 0;
        let patched = 0;
        let unparseable = 0;
        const samples: Array<{
            graceSku: string | null | undefined;
            itemName: string | null | undefined;
            extracted: string | null;
            capColor: string | null | undefined;
        }> = [];

        for (const p of page) {
            scanned++;
            if (!p.applicator || !TARGET_APPLICATORS.has(p.applicator)) continue;
            if (p.trimColor != null) continue;
            eligible++;

            const extracted = extractTrimColor(p.itemName);
            if (!extracted) {
                unparseable++;
                if (samples.length < 10) {
                    samples.push({
                        graceSku: p.graceSku,
                        itemName: p.itemName,
                        extracted: null,
                        capColor: p.capColor,
                    });
                }
                continue;
            }

            if (samples.length < 10) {
                samples.push({
                    graceSku: p.graceSku,
                    itemName: p.itemName,
                    extracted,
                    capColor: p.capColor,
                });
            }

            if (!dryRun) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await ctx.db.patch(p._id, { trimColor: extracted } as any);
            }
            patched++;
        }

        return {
            isDone,
            nextCursor: continueCursor,
            scanned,
            eligible,
            patched,
            unparseable,
            samples,
        };
    },
});

export const backfillTrimColor = action({
    args: { dryRun: v.optional(v.boolean()) },
    handler: async (
        ctx,
        args,
    ): Promise<{
        totalScanned: number;
        totalEligible: number;
        totalPatched: number;
        totalUnparseable: number;
        dryRun: boolean;
        sampleParses: Array<{
            graceSku: string | null | undefined;
            itemName: string | null | undefined;
            extracted: string | null;
            capColor: string | null | undefined;
        }>;
        sampleUnparseable: Array<{
            graceSku: string | null | undefined;
            itemName: string | null | undefined;
            extracted: string | null;
            capColor: string | null | undefined;
        }>;
    }> => {
        const dryRun = !!args.dryRun;
        let cursor: string | null = null;
        let totalScanned = 0;
        let totalEligible = 0;
        let totalPatched = 0;
        let totalUnparseable = 0;
        const sampleParses: Array<{
            graceSku: string | null | undefined;
            itemName: string | null | undefined;
            extracted: string | null;
            capColor: string | null | undefined;
        }> = [];
        const sampleUnparseable: Array<{
            graceSku: string | null | undefined;
            itemName: string | null | undefined;
            extracted: string | null;
            capColor: string | null | undefined;
        }> = [];

        do {
            const res: {
                isDone: boolean;
                nextCursor: string;
                scanned: number;
                eligible: number;
                patched: number;
                unparseable: number;
                samples: Array<{
                    graceSku: string | null | undefined;
                    itemName: string | null | undefined;
                    extracted: string | null;
                    capColor: string | null | undefined;
                }>;
            } = await ctx.runMutation(
                internal.backfillTrimColor.backfillTrimColorBatch,
                { cursor, dryRun },
            );
            totalScanned += res.scanned;
            totalEligible += res.eligible;
            totalPatched += res.patched;
            totalUnparseable += res.unparseable;
            for (const s of res.samples) {
                if (s.extracted && sampleParses.length < 20) sampleParses.push(s);
                if (!s.extracted && sampleUnparseable.length < 20) sampleUnparseable.push(s);
            }
            cursor = res.nextCursor;
            if (res.isDone) break;
        } while (cursor !== null);

        return {
            totalScanned,
            totalEligible,
            totalPatched,
            totalUnparseable,
            dryRun,
            sampleParses,
            sampleUnparseable,
        };
    },
});
