// catalog_gap_audit.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Cross-references every product in Convex against the productGroups table.
// Identifies orphaned products (in the DB but NOT showing in the catalog) and
// groups them by family so gaps can be prioritised and filled.
//
// Usage:
//   node scripts/catalog_gap_audit.mjs              # full report
//   node scripts/catalog_gap_audit.mjs --json       # machine-readable JSON
// ─────────────────────────────────────────────────────────────────────────────

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });

const JSON_MODE = process.argv.includes("--json");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// ── Helpers ──────────────────────────────────────────────────────────────────
const COMPONENT_CATEGORIES = new Set([
    "Component", "Cap/Closure", "Roll-On Cap", "Accessory",
    "Packaging", "Packaging Supply", "Tool", "Gift Box", "Gift Bag",
]);
const BOTTLE_CATEGORIES = new Set([
    "Glass Bottle", "Lotion Bottle", "Aluminum Bottle", "Plastic Bottle", "Cream Jar",
]);

function section(title) {
    if (!JSON_MODE) {
        console.log("\n" + "═".repeat(72));
        console.log(`  ${title}`);
        console.log("═".repeat(72));
    }
}

// ── 1. Pull all productGroups ─────────────────────────────────────────────────
section("Loading productGroups...");
const allGroups = await convex.query(api.products.getAllCatalogGroups, {});
const groupIds = new Set(allGroups.map(g => g._id));

// Build a quick lookup: groupId → group
const groupById = new Map(allGroups.map(g => [g._id, g]));

if (!JSON_MODE) {
    console.log(`  Total productGroups in catalog: ${allGroups.length}`);
    console.log(`  Total variants represented:     ${allGroups.reduce((s, g) => s + (g.variantCount ?? 0), 0)}`);
}

// ── 2. Page through ALL products ─────────────────────────────────────────────
section("Scanning all products in Convex...");

const allProducts = [];
let cursor = null;
let isDone = false;

while (!isDone) {
    const result = await convex.action(api.products.getProductExportPage, {
        cursor,
        numItems: 500,
    });
    allProducts.push(...result.page);
    isDone = result.isDone;
    cursor = result.continueCursor;
    if (!JSON_MODE) process.stdout.write(`\r  Loaded ${allProducts.length} products...`);
}
if (!JSON_MODE) console.log(`\r  Total products in DB: ${allProducts.length}         `);

// ── 3. Split into linked vs orphaned ─────────────────────────────────────────
const linked = [];
const orphaned = [];

for (const p of allProducts) {
    if (p.productGroupId && groupById.has(p.productGroupId)) {
        linked.push(p);
    } else {
        orphaned.push(p);
    }
}

// ── 4. Group orphans by category + family ────────────────────────────────────
const orphansByFamily = {};
for (const p of orphaned) {
    const cat  = p.category || "Unknown Category";
    const fam  = p.family   || "(no family)";
    const key  = `${cat} › ${fam}`;
    if (!orphansByFamily[key]) orphansByFamily[key] = [];
    orphansByFamily[key].push(p);
}

// ── 5. Separate bottle orphans from component orphans ────────────────────────
const bottleOrphans = orphaned.filter(p => BOTTLE_CATEGORIES.has(p.category));
const componentOrphans = orphaned.filter(p => COMPONENT_CATEGORIES.has(p.category));
const otherOrphans = orphaned.filter(p => !BOTTLE_CATEGORIES.has(p.category) && !COMPONENT_CATEGORIES.has(p.category));

// ── 6. Output ────────────────────────────────────────────────────────────────
if (JSON_MODE) {
    const report = {
        summary: {
            totalProductsInDB: allProducts.length,
            totalProductGroups: allGroups.length,
            linkedToGroup: linked.length,
            orphaned: orphaned.length,
            bottleOrphans: bottleOrphans.length,
            componentOrphans: componentOrphans.length,
            otherOrphans: otherOrphans.length,
        },
        orphansByFamily: Object.fromEntries(
            Object.entries(orphansByFamily)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([k, products]) => [k, products.map(p => ({
                    websiteSku: p.websiteSku,
                    graceSku: p.graceSku,
                    itemName: p.itemName,
                    applicator: p.applicator,
                    color: p.color,
                    capacityMl: p.capacityMl,
                    stockStatus: p.stockStatus,
                }))]),
        ),
    };
    const outPath = path.join(__dirname, "../data/catalog_gap_audit.json");
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Report written to data/catalog_gap_audit.json`);
    process.exit(0);
}

// ── Human-readable report ─────────────────────────────────────────────────────
section("SUMMARY");
console.log(`  Products in Convex DB:         ${allProducts.length}`);
console.log(`  productGroups in catalog:      ${allGroups.length}`);
console.log(`  ✅ Linked to a group:           ${linked.length}`);
console.log(`  ⚠️  Orphaned (NOT in catalog):  ${orphaned.length}`);
console.log(`     ↳ Bottle/jar orphans:        ${bottleOrphans.length}  ← these need groups`);
console.log(`     ↳ Component orphans:         ${componentOrphans.length}  ← caps, sprayers, etc.`);
console.log(`     ↳ Other orphans:             ${otherOrphans.length}  ← packaging, accessories`);

section("BOTTLE ORPHANS BY FAMILY (need product groups)");
const bottleGroups = {};
for (const p of bottleOrphans) {
    const fam = p.family || "(no family)";
    if (!bottleGroups[fam]) bottleGroups[fam] = [];
    bottleGroups[fam].push(p);
}
if (Object.keys(bottleGroups).length === 0) {
    console.log("  ✅ None — all bottle products are linked to groups!");
} else {
    Object.entries(bottleGroups)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([fam, prods]) => {
            console.log(`\n  ${fam}  (${prods.length} products)`);
            prods.forEach(p => {
                const cap = p.capacityMl ? `${p.capacityMl}ml` : p.capacity || "?ml";
                const col = p.color || "?";
                const app = p.applicator || "no applicator";
                console.log(`    ${(p.websiteSku || p.graceSku || "").padEnd(30)} ${cap.padEnd(8)} ${col.padEnd(12)} ${app}`);
            });
        });
}

section("COMPONENT ORPHANS BY FAMILY (caps, sprayers, pumps)");
const compGroups = {};
for (const p of componentOrphans) {
    const fam = p.family || "(no family)";
    if (!compGroups[fam]) compGroups[fam] = [];
    compGroups[fam].push(p);
}
if (Object.keys(compGroups).length === 0) {
    console.log("  ✅ None — all components are linked to groups!");
} else {
    Object.entries(compGroups)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([fam, prods]) => {
            console.log(`\n  ${fam}  (${prods.length} products)`);
            prods.slice(0, 5).forEach(p =>
                console.log(`    ${(p.websiteSku || p.graceSku || "").padEnd(30)} ${p.itemName?.slice(0, 50) || ""}`)
            );
            if (prods.length > 5) console.log(`    ... and ${prods.length - 5} more`);
        });
}

section("OTHER ORPHANS (packaging, accessories, misc)");
const otherGroups = {};
for (const p of otherOrphans) {
    const cat = p.category || "Unknown";
    if (!otherGroups[cat]) otherGroups[cat] = [];
    otherGroups[cat].push(p);
}
if (Object.keys(otherGroups).length === 0) {
    console.log("  ✅ None");
} else {
    Object.entries(otherGroups)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([cat, prods]) => {
            console.log(`\n  ${cat}  (${prods.length} products)`);
            prods.slice(0, 5).forEach(p =>
                console.log(`    ${(p.websiteSku || p.graceSku || "").padEnd(30)} ${p.itemName?.slice(0, 50) || ""}`)
            );
            if (prods.length > 5) console.log(`    ... and ${prods.length - 5} more`);
        });
}

section("CATALOG GROUP COUNTS BY FAMILY");
const catalogFamCounts = {};
allGroups.forEach(g => {
    if (!COMPONENT_CATEGORIES.has(g.category)) {
        const fam = g.family || "(no family)";
        catalogFamCounts[fam] = (catalogFamCounts[fam] || 0) + 1;
    }
});
console.log("  (bottle/jar families visible in sidebar)");
Object.entries(catalogFamCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([f, n]) => console.log(`  ${String(n).padStart(4)} groups — ${f}`));

console.log("\n  Run with --json to export full report to data/catalog_gap_audit.json\n");
