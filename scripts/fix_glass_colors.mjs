/**
 * fix_glass_colors.mjs
 *
 * Corrects miscategorised glass colors in productGroups and their variants:
 *
 *   White       → Clear   (white cap on clear glass bottle)
 *   Black       → Clear   (black roll-on cap on clear glass bottle)
 *   Blue        → Cobalt  (single 5ml cylinder; Blue is not a valid glass color)
 *   Cobalt Blue → Cobalt  (normalise to short form to match valid color list)
 *
 * Valid glass colors after this run: Clear, Frosted, Cobalt, Amber, Green, Swirl
 *
 * Run:  node scripts/fix_glass_colors.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");

const client = new ConvexHttpClient(CONVEX_URL);

const REMAP = [
    { from: "White",      to: "Clear"  },
    { from: "Black",      to: "Clear"  },
    { from: "Blue",       to: "Cobalt" },
    { from: "Cobalt Blue",to: "Cobalt" },
];

console.log("Fetching catalog groups…");
const groups = await client.query(api.products.getAllCatalogGroups, {});
console.log(`  Loaded ${groups.length} groups\n`);

let totalGroupsPatched = 0;
let totalVariantsPatched = 0;

for (const { from, to } of REMAP) {
    const targets = groups.filter((g) => g.color === from);
    if (targets.length === 0) {
        console.log(`${from} → ${to}: 0 groups (skipped)`);
        continue;
    }

    console.log(`${from} → ${to}: ${targets.length} groups`);
    targets.forEach((g) => console.log(`   ${g.slug} (${g.capacityMl}ml)`));

    // 1. Patch productGroups
    for (const g of targets) {
        await client.mutation(api.migrations.patchProductGroupFields, {
            id: g._id,
            fields: { color: to },
        });
        totalGroupsPatched++;
    }

    // 2. Patch variant products
    const result = await client.mutation(api.migrations.patchVariantsFieldBatch, {
        groupIds: targets.map((g) => g._id),
        field: "color",
        fromValue: from,
        toValue: to,
    });
    totalVariantsPatched += result.patched;
    console.log(`   → ${result.patched} variant products patched\n`);
}

console.log(`Done.`);
console.log(`  productGroups patched: ${totalGroupsPatched}`);
console.log(`  variant products patched: ${totalVariantsPatched}`);
