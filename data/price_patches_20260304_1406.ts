// AUTO-GENERATED — DO NOT EDIT BY HAND
// Source: scripts/convex_price_audit.py
// Generated: 2026-03-04T14:07:01.206353
// Total patches: 8
//
// ─── INSTRUCTIONS ───────────────────────────────────────────────────────────
// 1. Open convex/migrations.ts
// 2. Add this import at the top (if not already present):
//      import { PRICE_PATCHES_20260304_1406 } from "../data/price_patches_20260304_1406";
// 3. Copy the applyPricePatches_20260304_1406 mutation below into convex/migrations.ts
// 4. Run: npx convex run migrations:applyPricePatches_20260304_1406 --prod
// ─────────────────────────────────────────────────────────────────────────────

export const PRICE_PATCHES_20260304_1406 = [
  {
  graceSku: "AB-ALU-CLR-120ML-LPM-WHT",
  webPrice1pc:  0.27,   // was: 1.3
},
  {
  graceSku: "AB-ALU-CLR-250ML-SPR-BLK",
  webPrice1pc:  1.17,   // was: 1.95
},
  {
  graceSku: "AB-ALU-CLR-120ML-LPM-BLK",
  webPrice1pc:  1.01,   // was: 1.3
},
  {
  graceSku: "AB-ALU-CLR-100ML-SPR-BLK",
  webPrice1pc:  0.98,   // was: 1.25
},
  {
  graceSku: "CMP-APP-BLK-18-400",
  webPrice1pc:  0.33,   // was: 0.42
},
  {
  graceSku: "CMP-CAP-BLK-18-400",
  webPrice1pc:  0.25,   // was: 0.32
},
  {
  graceSku: "CMP-CAP-BLK-20-400-2OZ",
  webPrice1pc:  0.16,   // was: 0.2
},
  {
  graceSku: "CMP-CAP-BLK-20-400-1OZ",
  webPrice1pc:  0.16,   // was: 0.2
},
];

// ─── Paste into convex/migrations.ts ────────────────────────────────────────
/*
import { mutation } from "./_generated/server";
import { PRICE_PATCHES_20260304_1406 } from "../data/price_patches_20260304_1406";

export const applyPricePatches_20260304_1406 = mutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0, notFound = 0;
    for (const patch of PRICE_PATCHES_20260304_1406) {
      const doc = await ctx.db
        .query("products")
        .withIndex("by_graceSku", (q) => q.eq("graceSku", patch.graceSku))
        .first();
      if (!doc) { console.warn("NOT FOUND:", patch.graceSku); notFound++; continue; }
      const upd: Record<string, number> = {};
      if (patch.webPrice1pc  != null) upd.webPrice1pc  = patch.webPrice1pc;
      if (patch.webPrice10pc != null) upd.webPrice10pc = patch.webPrice10pc;
      if (patch.webPrice12pc != null) upd.webPrice12pc = patch.webPrice12pc;
      await ctx.db.patch(doc._id, upd);
      updated++;
    }
    return `✅ Patched ${updated} products. ⚠️ ${notFound} SKUs not found.`;
  },
});
*/
