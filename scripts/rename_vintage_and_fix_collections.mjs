/**
 * rename_vintage_and_fix_collections.mjs
 *
 * Task A – Rename Antique Bulb Spray → Vintage Bulb Spray (all 3 layers):
 *   1. productGroups.applicatorTypes  → replace "Antique Bulb Sprayer*" with "Vintage Bulb Sprayer*"
 *   2. productGroups.displayName      → replace "Antique" with "Vintage"
 *   3. products.applicator            → replace "Antique Bulb Sprayer*" with "Vintage Bulb Sprayer*"
 *
 * Task B – Fix bottleCollection inconsistencies:
 *   "Green Glass"           → "Vial"
 *   "Pillar Collection"     → "Pillar"
 *   "Bell Collection"       → "Bell"
 *   "Tulip Collection"      → "Tulip"
 *   "Elegant Collection"    → "Elegant"
 *   "Vial & Sample Collection" → "Vial"
 *   "Spray Bottle"          → "Cylinder"  (these are Cylinder-family bottles)
 *   null glass bottles      → derived from family field
 *
 * SKUs are never touched.
 *
 * Run:  node scripts/rename_vintage_and_fix_collections.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");

const client = new ConvexHttpClient(CONVEX_URL);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function replaceAntique(str) {
    return str
        .replace(/Antique Bulb Sprayer with Tassel/g, "Vintage Bulb Sprayer with Tassel")
        .replace(/Antique Bulb Sprayer/g, "Vintage Bulb Sprayer")
        .replace(/Antique Bulb Spray/g, "Vintage Bulb Spray");
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch all groups
// ─────────────────────────────────────────────────────────────────────────────
console.log("Fetching catalog groups…");
const groups = await client.query(api.products.getAllCatalogGroups, {});
console.log(`  Loaded ${groups.length} groups\n`);

// ═════════════════════════════════════════════════════════════════════════════
// TASK A — Vintage rename
// ═════════════════════════════════════════════════════════════════════════════
console.log("━━━ TASK A: Antique → Vintage rename ━━━");

const antiqueGroups = groups.filter((g) =>
    (g.applicatorTypes ?? []).some((t) => t.startsWith("Antique Bulb"))
);
console.log(`Groups with Antique applicatorTypes: ${antiqueGroups.length}`);

let groupsPatched = 0;
for (const g of antiqueGroups) {
    const newTypes = (g.applicatorTypes ?? []).map(replaceAntique);
    const newName  = replaceAntique(g.displayName);
    const fields = {};
    if (JSON.stringify(newTypes) !== JSON.stringify(g.applicatorTypes)) fields.applicatorTypes = newTypes;
    if (newName !== g.displayName) fields.displayName = newName;
    if (Object.keys(fields).length > 0) {
        await client.mutation(api.migrations.patchProductGroupFields, { id: g._id, fields });
        groupsPatched++;
    }
}
console.log(`  productGroups patched: ${groupsPatched}`);

// Patch variant products for all antique groups (both applicator values)
console.log("  Patching variant products (Antique Bulb Sprayer)…");
const r1 = await client.mutation(api.migrations.patchVariantsFieldBatch, {
    groupIds: antiqueGroups.map((g) => g._id),
    field: "applicator",
    fromValue: "Antique Bulb Sprayer",
    toValue: "Vintage Bulb Sprayer",
});
console.log(`    "Antique Bulb Sprayer" variants patched: ${r1.patched}`);

const r2 = await client.mutation(api.migrations.patchVariantsFieldBatch, {
    groupIds: antiqueGroups.map((g) => g._id),
    field: "applicator",
    fromValue: "Antique Bulb Sprayer with Tassel",
    toValue: "Vintage Bulb Sprayer with Tassel",
});
console.log(`    "Antique Bulb Sprayer with Tassel" variants patched: ${r2.patched}`);

// ═════════════════════════════════════════════════════════════════════════════
// TASK B — Fix bottleCollection values
// ═════════════════════════════════════════════════════════════════════════════
console.log("\n━━━ TASK B: Fix bottleCollection ━━━");

const COLL_REMAP = [
    { from: "Green Glass",              to: "Vial"     },
    { from: "Pillar Collection",        to: "Pillar"   },
    { from: "Bell Collection",          to: "Bell"     },
    { from: "Tulip Collection",         to: "Tulip"    },
    { from: "Elegant Collection",       to: "Elegant"  },
    { from: "Vial & Sample Collection", to: "Vial"     },
    { from: "Spray Bottle",             to: "Cylinder" },
];

let collectionGroupsPatched = 0;
for (const { from, to } of COLL_REMAP) {
    const targets = groups.filter((g) => g.bottleCollection === from);
    if (targets.length === 0) {
        console.log(`  "${from}" → "${to}": 0 groups (skipped)`);
        continue;
    }
    for (const g of targets) {
        await client.mutation(api.migrations.patchProductGroupFields, {
            id: g._id,
            fields: { bottleCollection: to },
        });
        collectionGroupsPatched++;
    }
    console.log(`  "${from}" → "${to}": ${targets.length} groups patched`);
}

// Assign bottleCollection to null glass bottle groups based on their family
const NULL_GLASS = groups.filter((g) => g.category === "Glass Bottle" && !g.bottleCollection);
console.log(`\n  Null-bottleCollection Glass Bottles to fix: ${NULL_GLASS.length}`);

let nullFixed = 0;
for (const g of NULL_GLASS) {
    if (!g.family) { console.log(`    SKIP (no family): ${g.slug}`); continue; }
    await client.mutation(api.migrations.patchProductGroupFields, {
        id: g._id,
        fields: { bottleCollection: g.family },
    });
    console.log(`    ${g.slug} → "${g.family}"`);
    nullFixed++;
}
console.log(`  Null glass bottles fixed: ${nullFixed}`);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n✓ All done.");
console.log(`  Vintage rename:       ${groupsPatched} groups, ${r1.patched + r2.patched} variant products`);
console.log(`  Collection remaps:    ${collectionGroupsPatched} groups`);
console.log(`  Null glass assigned:  ${nullFixed} groups`);
