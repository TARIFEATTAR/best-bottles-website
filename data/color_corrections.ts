// COLOR CORRECTION MIGRATION — March 4 2026
// Fixes 72 frosted glass products incorrectly classified as Clear
// Source: color_mismatch_report.json (websiteSku/URL vs graceSku contradiction)
// Run via: npx convex run migrations:fixFrostedColorMismatches

import { mutation } from "../convex/_generated/server";

const COLOR_CORRECTIONS = [
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-12",
    "newGraceSku": "GB-DVA-FRS-46ML-T-12",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-13",
    "newGraceSku": "GB-DVA-FRS-46ML-T-13",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-14",
    "newGraceSku": "GB-DVA-FRS-46ML-T-14",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-15",
    "newGraceSku": "GB-DVA-FRS-46ML-T-15",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-16",
    "newGraceSku": "GB-DVA-FRS-46ML-T-16",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-17",
    "newGraceSku": "GB-DVA-FRS-46ML-T-17",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-18",
    "newGraceSku": "GB-DVA-FRS-46ML-T-18",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-19",
    "newGraceSku": "GB-DVA-FRS-46ML-T-19",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-20",
    "newGraceSku": "GB-DVA-FRS-46ML-T-20",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-21",
    "newGraceSku": "GB-DVA-FRS-46ML-T-21",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-22",
    "newGraceSku": "GB-DVA-FRS-46ML-T-22",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-23",
    "newGraceSku": "GB-DVA-FRS-46ML-T-23",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-24",
    "newGraceSku": "GB-DVA-FRS-46ML-T-24",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-25",
    "newGraceSku": "GB-DVA-FRS-46ML-T-25",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-26",
    "newGraceSku": "GB-DVA-FRS-46ML-T-26",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-27",
    "newGraceSku": "GB-DVA-FRS-46ML-T-27",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-28",
    "newGraceSku": "GB-DVA-FRS-46ML-T-28",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-29",
    "newGraceSku": "GB-DVA-FRS-46ML-T-29",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-30",
    "newGraceSku": "GB-DVA-FRS-46ML-T-30",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-31",
    "newGraceSku": "GB-DVA-FRS-46ML-T-31",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-32",
    "newGraceSku": "GB-DVA-FRS-46ML-T-32",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-33",
    "newGraceSku": "GB-DVA-FRS-46ML-T-33",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-34",
    "newGraceSku": "GB-DVA-FRS-46ML-T-34",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-35",
    "newGraceSku": "GB-DVA-FRS-46ML-T-35",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-36",
    "newGraceSku": "GB-DVA-FRS-46ML-T-36",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-37",
    "newGraceSku": "GB-DVA-FRS-46ML-T-37",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-38",
    "newGraceSku": "GB-DVA-FRS-46ML-T-38",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-39",
    "newGraceSku": "GB-DVA-FRS-46ML-T-39",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-40",
    "newGraceSku": "GB-DVA-FRS-46ML-T-40",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-T-41",
    "newGraceSku": "GB-DVA-FRS-46ML-T-41",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle Tall Cap"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-01",
    "newGraceSku": "GB-DVA-FRS-46ML-01",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-02",
    "newGraceSku": "GB-DVA-FRS-46ML-02",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-03",
    "newGraceSku": "GB-DVA-FRS-46ML-03",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-04",
    "newGraceSku": "GB-DVA-FRS-46ML-04",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-05",
    "newGraceSku": "GB-DVA-FRS-46ML-05",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle"
  },
  {
    "oldGraceSku": "GB-DVA-CLR-46ML-06",
    "newGraceSku": "GB-DVA-FRS-46ML-06",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Frosted Glass Bottle"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-100ML-ASP-WHT-02",
    "newGraceSku": "GB-ELG-FRS-100ML-ASP-WHT-02",
    "color": "Frosted",
    "itemName": "Elegant 100 ml (3.38 oz) Frosted Glass Bottle with Antique Sprayer White Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-BLK-S-02",
    "newGraceSku": "GB-ELG-FRS-15ML-BLK-S-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle Short Black Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SGLD-T",
    "newGraceSku": "GB-ELG-FRS-15ML-SGLD-T",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle Tall Shiny Gold Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-MRL-BLK-01",
    "newGraceSku": "GB-ELG-FRS-15ML-MRL-BLK-01",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Black Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-MRL-BLK-02",
    "newGraceSku": "GB-ELG-FRS-15ML-MRL-BLK-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Black Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-MRL-MCPR-02",
    "newGraceSku": "GB-ELG-FRS-15ML-MRL-MCPR-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Matte Copper Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-MRL-SGLD-02",
    "newGraceSku": "GB-ELG-FRS-15ML-MRL-SGLD-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Shiny Gold Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-MRL",
    "newGraceSku": "GB-ELG-FRS-15ML-MRL",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-MRL-SLV-01",
    "newGraceSku": "GB-ELG-FRS-15ML-MRL-SLV-01",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-MRL-MSLV-02",
    "newGraceSku": "GB-ELG-FRS-15ML-MRL-MSLV-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Matte Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-MRL-SLV-02",
    "newGraceSku": "GB-ELG-FRS-15ML-MRL-SLV-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Metal Roller Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-RBL-BLK-01",
    "newGraceSku": "GB-ELG-FRS-15ML-RBL-BLK-01",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Black Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-RBL-BLK-02",
    "newGraceSku": "GB-ELG-FRS-15ML-RBL-BLK-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Black Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-RBL-MCPR",
    "newGraceSku": "GB-ELG-FRS-15ML-RBL-MCPR",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Matte Copper Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-RBL-SGLD",
    "newGraceSku": "GB-ELG-FRS-15ML-RBL-SGLD",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Shiny Gold Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-RBL",
    "newGraceSku": "GB-ELG-FRS-15ML-RBL",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-RBL-SLV-01",
    "newGraceSku": "GB-ELG-FRS-15ML-RBL-SLV-01",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-RBL-MSLV",
    "newGraceSku": "GB-ELG-FRS-15ML-RBL-MSLV",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Matte Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-RBL-SLV-02",
    "newGraceSku": "GB-ELG-FRS-15ML-RBL-SLV-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Roller Ball Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SLV-T-02",
    "newGraceSku": "GB-ELG-FRS-15ML-SLV-T-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle Tall Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SPR-BLK-01",
    "newGraceSku": "GB-ELG-FRS-15ML-SPR-BLK-01",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Black Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SPR-BLK-02",
    "newGraceSku": "GB-ELG-FRS-15ML-SPR-BLK-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Black Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SPR",
    "newGraceSku": "GB-ELG-FRS-15ML-SPR",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SPR-MCPR-02",
    "newGraceSku": "GB-ELG-FRS-15ML-SPR-MCPR-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Matte Copper Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SPR-SGLD-02",
    "newGraceSku": "GB-ELG-FRS-15ML-SPR-SGLD-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Shiny Gold Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SPR-MSLV-02",
    "newGraceSku": "GB-ELG-FRS-15ML-SPR-MSLV-02",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Matte Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-SPR-SLV",
    "newGraceSku": "GB-ELG-FRS-15ML-SPR-SLV",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle with Sprayer Silver Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-15ML-WHT-S",
    "newGraceSku": "GB-ELG-FRS-15ML-WHT-S",
    "color": "Frosted",
    "itemName": "Elegant 15 ml (0.51 oz) Frosted Glass Bottle Short White Cap"
  },
  {
    "oldGraceSku": "GB-ELG-CLR-60ML-ASP-WHT-02",
    "newGraceSku": "GB-ELG-FRS-60ML-ASP-WHT-02",
    "color": "Frosted",
    "itemName": "Elegant 60 ml (2.03 oz) Frosted Glass Bottle with Antique Sprayer White Cap"
  },
  {
    "oldGraceSku": "LB-DVA-CLR-46ML-T",
    "newGraceSku": "LB-DVA-FRS-46ML-T",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Clear Lotion Bottle Tall Cap"
  },
  {
    "oldGraceSku": "LB-DVA-CLR-46ML-01",
    "newGraceSku": "LB-DVA-FRS-46ML-01",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Clear Lotion Bottle"
  },
  {
    "oldGraceSku": "LB-DVA-CLR-46ML-02",
    "newGraceSku": "LB-DVA-FRS-46ML-02",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Clear Lotion Bottle"
  },
  {
    "oldGraceSku": "LB-DVA-CLR-46ML-03",
    "newGraceSku": "LB-DVA-FRS-46ML-03",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Clear Lotion Bottle"
  },
  {
    "oldGraceSku": "LB-DVA-CLR-46ML-04",
    "newGraceSku": "LB-DVA-FRS-46ML-04",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Clear Lotion Bottle"
  },
  {
    "oldGraceSku": "LB-DVA-CLR-46ML-05",
    "newGraceSku": "LB-DVA-FRS-46ML-05",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Clear Lotion Bottle"
  },
  {
    "oldGraceSku": "LB-DVA-CLR-46ML-06",
    "newGraceSku": "LB-DVA-FRS-46ML-06",
    "color": "Frosted",
    "itemName": "Diva 46 ml (1.56 oz) Clear Lotion Bottle"
  }
] as const;

export const fixFrostedColorMismatches = mutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0, missing = 0;
    for (const patch of COLOR_CORRECTIONS) {
      const doc = await ctx.db
        .query("products")
        .withIndex("by_graceSku", (q) => q.eq("graceSku", patch.oldGraceSku))
        .first();
      if (!doc) {
        console.warn("NOT FOUND:", patch.oldGraceSku);
        missing++;
        continue;
      }
      await ctx.db.patch(doc._id, {
        graceSku: patch.newGraceSku,
        color:    patch.color,
        itemName: patch.itemName || doc.itemName,
      });
      updated++;
    }
    return `Color corrections applied: ${updated} updated, ${missing} not found.`;
  },
});
