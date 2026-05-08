import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Backfill trimColor for Empire sprayer/atomizer SKUs that currently have
 * trimColor: null. Madison's gold-standard prompt expects "Shiny Silver trim"
 * for all single-tone Empire sprayers (e.g. AST-RED). The two-tone Ivory
 * variants (suffix -IV??, e.g. AST-IVGD / ASP-IVSL) already have correct
 * trimColor values and are excluded.
 *
 * Run dry-run:
 *   npx convex run backfillEmpireSprayerTrimColor:backfill '{"dryRun": true}'
 * Apply:
 *   npx convex run backfillEmpireSprayerTrimColor:backfill '{"dryRun": false}'
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

const TWO_TONE_IV_SUFFIX = /-IV[A-Z]{2}$/;
const DEFAULT_TRIM_COLOR = "Shiny Silver";

export const backfill = internalMutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, args) => {
    const empireProducts = await ctx.db
      .query("products")
      .withIndex("by_family", (q) => q.eq("family", "Empire"))
      .collect();

    const targets: Array<{
      graceSku: string;
      applicator: string | undefined;
      capColor: string | undefined;
    }> = [];
    const skipped = {
      notTrimBearing: 0,
      alreadyHasTrim: 0,
      twoToneIv: 0,
    };

    for (const p of empireProducts) {
      if (!p.applicator || !TRIM_BEARING_APPLICATORS.has(p.applicator)) {
        skipped.notTrimBearing++;
        continue;
      }
      if (p.trimColor) {
        skipped.alreadyHasTrim++;
        continue;
      }
      if (TWO_TONE_IV_SUFFIX.test(p.graceSku)) {
        skipped.twoToneIv++;
        continue;
      }
      targets.push({
        graceSku: p.graceSku,
        applicator: p.applicator,
        capColor: p.capColor ?? undefined,
      });

      if (!args.dryRun) {
        await ctx.db.patch(p._id, { trimColor: DEFAULT_TRIM_COLOR });
      }
    }

    return {
      dryRun: args.dryRun,
      empireTotal: empireProducts.length,
      wouldUpdate: targets.length,
      updatedTrimColor: args.dryRun ? null : DEFAULT_TRIM_COLOR,
      skipped,
      sampleTargets: targets.slice(0, 10),
      allTargetSkus: targets.map((t) => t.graceSku),
    };
  },
});
