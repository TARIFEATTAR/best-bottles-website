import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Fix Empire family diameter values. Empire is a square prism; the prior
 * values (~72 / ~78) were wrong by a wide margin and were causing distorted
 * AI-generated catalog images downstream in Madison Studio (which bakes
 * Convex's products.diameter into every image-generation prompt as the
 * bottle's face width).
 *
 * Correct values (Grace Item Width spec; stored as formatted strings to
 * match the existing dataset's "{value} ±{tolerance} mm" convention and the
 * products.diameter schema = v.union(v.string(), v.null())):
 *   capacityMl === 50  → "37 ±0.5 mm"
 *   capacityMl === 100 → "46 ±0.5 mm"
 *
 * Empire rows at any other capacity are flagged in `skipped` and not patched
 * — surface those to the user so the correct value can be sourced from the
 * live bestbottles site or Grace's master sheet before a second pass.
 *
 * Idempotent: rows already at the correct value are counted under
 * `alreadyCorrect` and left untouched.
 *
 * Usage:
 *   Dry-run dev:  npx convex run fixEmpireDiameters:fixEmpireDiameters
 *   Apply dev:    npx convex run fixEmpireDiameters:fixEmpireDiameters '{"dryRun":false}'
 *   Apply prod:   CONVEX_DEPLOY_KEY=<prod-key> npx convex run fixEmpireDiameters:fixEmpireDiameters '{"dryRun":false}'
 */
export const fixEmpireDiameters = internalMutation({
    args: { dryRun: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const dryRun = args.dryRun ?? true;

        const empireRows = await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", "Empire"))
            .collect();

        let updated50 = 0;
        let updated100 = 0;
        let alreadyCorrect = 0;
        const skipped: Array<{ graceSku: string; capacityMl: unknown }> = [];

        for (const row of empireRows) {
            let target: string | null = null;
            if (row.capacityMl === 50) target = "37 ±0.5 mm";
            else if (row.capacityMl === 100) target = "46 ±0.5 mm";

            if (target === null) {
                skipped.push({ graceSku: row.graceSku, capacityMl: row.capacityMl });
                continue;
            }

            if (row.diameter === target) {
                alreadyCorrect++;
                continue;
            }

            if (!dryRun) {
                await ctx.db.patch(row._id, { diameter: target });
            }
            if (row.capacityMl === 50) updated50++;
            else updated100++;
        }

        return {
            dryRun,
            totalEmpire: empireRows.length,
            updated50,
            updated100,
            alreadyCorrect,
            skipped,
        };
    },
});
