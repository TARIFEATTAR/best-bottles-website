/**
 * split_spray_by_capacity.mjs
 *
 * Patches all productGroups where applicatorTypes contains "Fine Mist Sprayer"
 * AND capacityMl >= 30  →  applicatorTypes becomes ["Perfume Spray Pump"]
 *
 * Also patches every variant product in those groups so applicator matches.
 *
 * Run:  node scripts/split_spray_by_capacity.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");

const client = new ConvexHttpClient(CONVEX_URL);

// ── 1. Fetch all catalog groups ─────────────────────────────────────────────
console.log("Fetching catalog groups…");
const groups = await client.query(api.products.getAllCatalogGroups, {});
console.log(`  Loaded ${groups.length} groups`);

// ── 2. Identify targets: Fine Mist Sprayer applicator + capacityMl >= 30 ────
const targets = groups.filter((g) => {
    const types = g.applicatorTypes ?? [];
    return (
        types.includes("Fine Mist Sprayer") &&
        typeof g.capacityMl === "number" &&
        g.capacityMl >= 30
    );
});

console.log(`\nGroups to reclassify → Perfume Spray Pump: ${targets.length}`);
if (targets.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
}

// Pretty-print what we're about to change
for (const g of targets) {
    console.log(`  ${g.slug ?? g._id}  (${g.capacityMl}ml)`);
}

// ── 3. Patch each group ──────────────────────────────────────────────────────
console.log("\nPatching productGroups…");
let groupsPatched = 0;
for (const g of targets) {
    // Replace Fine Mist Sprayer with Perfume Spray Pump; keep any other types
    const newTypes = (g.applicatorTypes ?? []).map((t) =>
        t === "Fine Mist Sprayer" ? "Perfume Spray Pump" : t
    );
    await client.mutation(api.migrations.patchProductGroupFields, {
        id: g._id,
        fields: { applicatorTypes: newTypes },
    });
    groupsPatched++;
    process.stdout.write(`\r  ${groupsPatched}/${targets.length}`);
}
console.log(`\n  Done — ${groupsPatched} groups updated.`);

// ── 4. Patch all variant products in a single server-side batch call ─────────
console.log("\nPatching variant products (server-side batch)…");
const groupIds = targets.map((g) => g._id);

const result = await client.mutation(api.migrations.patchVariantApplicatorBatch, {
    groupIds,
    fromApplicator: "Fine Mist Sprayer",
    toApplicator: "Perfume Spray Pump",
});

console.log(`  Done — ${result.patched} products patched.`);
console.log("\nAll done. Deploy the UI changes and the split is live.");
