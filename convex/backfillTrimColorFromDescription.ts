import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Parse trimColor from each product's PDP description (the live BestBottles
 * page text). Replaces rule-based assumptions ("default to Shiny Silver")
 * with description-derived values, e.g. AST-PNK's description says
 * "shiny gold collar cap" — the value should be "Shiny Gold", not "Shiny
 * Silver".
 *
 * Field note: the user spec referenced `graceDescription`, but that field
 * is populated on only 15/2325 rows. The actual PDP-derived text lives in
 * `itemDescription` (populated on all rows). Both are checked, with
 * graceDescription preferred when present.
 *
 * Match rule: /with (shiny|matte) (silver|gold|copper|black|rose gold) collar/i
 * If a description doesn't match (e.g. SPR variants phrase as "matte silver
 * spray pump", no "collar" keyword), the existing trimColor is left intact.
 *
 * Run dry-run for Empire only:
 *   npx convex run backfillTrimColorFromDescription:backfill '{"dryRun": true, "family": "Empire"}'
 * Apply for Empire:
 *   npx convex run backfillTrimColorFromDescription:backfill '{"dryRun": false, "family": "Empire"}'
 * Apply across all families:
 *   npx convex run backfillTrimColorFromDescription:backfill '{"dryRun": false}'
 */

const TRIM_BEARING_APPLICATORS = new Set([
  "Vintage Bulb Sprayer",
  "Vintage Bulb Sprayer with Tassel",
  "Antique Bulb Sprayer",
  "Antique Bulb Sprayer with Tassel",
  "Fine Mist Sprayer",
  "Perfume Spray Pump",
  "Atomizer",
  "Metal Atomizer",
]);

// "with shiny gold collar cap" / "with matte rose gold collar"
const COLLAR_REGEX =
  /with\s+(shiny|matte)\s+(silver|gold|copper|black|rose\s+gold)\s+collar/i;

function normalizeTrim(modifier: string, color: string): string {
  const mod = modifier.toLowerCase() === "shiny" ? "Shiny" : "Matte";
  const colorKey = color.toLowerCase().replace(/\s+/g, " ");
  const colorMap: Record<string, string> = {
    silver: "Silver",
    gold: "Gold",
    copper: "Copper",
    black: "Black",
    "rose gold": "Rose Gold",
  };
  return `${mod} ${colorMap[colorKey] ?? color}`;
}

function extractTrim(...descriptions: Array<string | null | undefined>): string | null {
  for (const desc of descriptions) {
    if (!desc) continue;
    const m = desc.match(COLLAR_REGEX);
    if (m) return normalizeTrim(m[1], m[2]);
  }
  return null;
}

export const backfill = internalMutation({
  args: {
    dryRun: v.boolean(),
    family: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const products = args.family
      ? await ctx.db
          .query("products")
          .withIndex("by_family", (q) => q.eq("family", args.family ?? null))
          .collect()
      : await ctx.db.query("products").collect();

    let matchedAndChanged = 0;
    let matchedNoChange = 0;
    let unmatchedKeptExisting = 0;
    let skippedNotTrimBearing = 0;
    const distribution: Record<string, number> = {};
    const familyMatched: Record<string, number> = {};
    const sampleChanges: Array<{
      graceSku: string;
      family: string | null;
      before: string | null;
      after: string;
    }> = [];
    const unmatchedSamples: Array<{
      graceSku: string;
      family: string | null;
      applicator: string | null;
      existing: string | null;
      descriptionExcerpt: string;
    }> = [];

    for (const p of products) {
      if (!p.applicator || !TRIM_BEARING_APPLICATORS.has(p.applicator)) {
        skippedNotTrimBearing++;
        continue;
      }
      const extracted = extractTrim(p.graceDescription, p.itemDescription);
      if (extracted == null) {
        unmatchedKeptExisting++;
        if (unmatchedSamples.length < 8) {
          const desc = p.itemDescription ?? p.graceDescription ?? "";
          unmatchedSamples.push({
            graceSku: p.graceSku,
            family: p.family ?? null,
            applicator: p.applicator,
            existing: p.trimColor ?? null,
            descriptionExcerpt: desc.slice(0, 180),
          });
        }
        continue;
      }
      distribution[extracted] = (distribution[extracted] ?? 0) + 1;
      const fam = p.family ?? "(none)";
      familyMatched[fam] = (familyMatched[fam] ?? 0) + 1;

      if (p.trimColor === extracted) {
        matchedNoChange++;
        continue;
      }
      matchedAndChanged++;
      if (sampleChanges.length < 12) {
        sampleChanges.push({
          graceSku: p.graceSku,
          family: p.family ?? null,
          before: p.trimColor ?? null,
          after: extracted,
        });
      }
      if (!args.dryRun) {
        await ctx.db.patch(p._id, { trimColor: extracted });
      }
    }

    return {
      dryRun: args.dryRun,
      familyFilter: args.family ?? "(all)",
      productsScanned: products.length,
      matchedAndChanged,
      matchedNoChange,
      unmatchedKeptExisting,
      skippedNotTrimBearing,
      distribution,
      familyMatched,
      sampleChanges,
      unmatchedSamples,
    };
  },
});
