#!/usr/bin/env node
/**
 * run_alignment_fixes.mjs — Apply P1 alignment fixes found by alignment_check.mjs
 *
 * Fix 1 — Collection name normalization (products + productGroups):
 *   "Royal Collection"          → "Royal"
 *   "Flair Collection"          → "Flair"
 *   "Square Collection"         → "Square"
 *   "Plastic Bottle Collection" → "Plastic Bottle"
 *   "Cylinder Collection"       → "Cylinder"
 *   "Tulip Collection"          → "Tulip"
 *   "Bell Collection"           → "Bell"
 *   "Vial & Sample Collection"  → "Vial"
 *   "Pillar Collection"         → "Pillar"
 *   "Atomizer Collection"       → "Atomizer"
 *
 * Fix 2 — Component misclassifications (5 SKUs):
 *   CMP-CAP-PNK-18-415     family/collection: Roll-On Cap → Sprayer
 *   CMP-LPM-SGLD-18-415    family/collection: Roll-On Cap → Lotion Pump
 *   CMP-LPM-SBLK-18-415    family/collection: Roll-On Cap → Lotion Pump
 *   CMP-LPM-MSLV-18-415-02 family/collection: Roll-On Cap → Lotion Pump
 *   CMP-LPM-SSLV-18-415    family/collection: Roll-On Cap → Lotion Pump
 *
 * Fix 3 — Wrong-category products in wrong productGroups (2 products):
 *   BB-ALU250SPRYBL        category: "Component" → "Aluminum Bottle"
 *   BB-CREAMJARAMB5MLSLCAP category: "Component" → "Cream Jar"
 *
 * Usage:
 *   node scripts/run_alignment_fixes.mjs           ← dry run (default)
 *   node scripts/run_alignment_fixes.mjs --apply   ← write changes to Convex
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = resolve(__dirname, "..", ".env.local");
try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.includes("#")) val = val.slice(0, val.indexOf("#")).trim();
        if (!process.env[key]) process.env[key] = val;
    }
} catch { /* .env.local optional */ }

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
    process.exit(1);
}

const apply = process.argv.includes("--apply");
const client = new ConvexHttpClient(CONVEX_URL);

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║        ALIGNMENT FIXES — Best Bottles                ║");
console.log("╚══════════════════════════════════════════════════════╝");
console.log(apply ? "  MODE: APPLY (writing changes to Convex)\n"
                  : "  MODE: DRY RUN (pass --apply to write changes)\n");

// ── Fix 1a: Normalize product bottleCollection fields (paginated) ──────────
console.log("── FIX 1a: Normalize product bottleCollection (paginated) ──");
let cursor = null;
let totalScanned = 0;
let totalUpdated = 0;
let allExamples = [];
let batchNum = 1;

while (true) {
    const result = await client.mutation(api.migrations.normalizeCollectionNames, {
        cursor,
        batchSize: 200,
        apply,
    });
    totalScanned += result.scanned;
    totalUpdated += result.updated;
    allExamples.push(...result.examples);
    if (result.updated > 0) {
        console.log(`  Batch ${batchNum}: scanned=${result.scanned} updated=${result.updated}`);
    }
    if (!result.hasMore) break;
    cursor = result.nextCursor;
    batchNum++;
}

console.log(`  Total scanned: ${totalScanned}  |  ${apply ? "Updated" : "Would update"}: ${totalUpdated}`);
if (allExamples.length) {
    console.log("  Examples:");
    for (const ex of allExamples) console.log(`    ${ex}`);
}

// ── Fix 1b: Normalize productGroup bottleCollection fields ─────────────────
console.log("\n── FIX 1b: Normalize productGroup bottleCollection ──");
const groupResult = await client.mutation(api.migrations.normalizeGroupCollectionNames, { apply });
console.log(`  ${apply ? "Updated" : "Would update"}: ${groupResult.updated} groups`);
if (groupResult.examples.length) {
    console.log("  Examples:");
    for (const ex of groupResult.examples) console.log(`    ${ex}`);
}

// ── Fix 2: Correct misclassified component SKUs ────────────────────────────
console.log("\n── FIX 2: Component family/collection misclassifications ──");
const compResult = await client.mutation(api.migrations.fixComponentMisclassifications, { apply });
for (const r of compResult.results) {
    const icon = r.status === "fixed" ? "✅" : r.status === "not_found" ? "❌" : "⏭ ";
    console.log(`  ${icon} ${r.graceSku}  [${r.status}]`);
}

// ── Fix 3: Wrong-category products in wrong productGroups ──────────────────
console.log("\n── FIX 3: Wrong-category products in wrong productGroups ──");
const groupLinkResult = await client.mutation(api.migrations.fixWrongGroupLinks, { apply });
for (const r of groupLinkResult.results) {
    const icon = r.status === "fixed" ? "✅" : r.status === "not_found" ? "❌" : "⏭ ";
    console.log(`  ${icon} ${r.websiteSku}  [${r.status}]`);
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════");
const fixedComponents  = compResult.results.filter(r => r.status === "fixed").length;
const fixedGroupLinks  = groupLinkResult.results.filter(r => r.status === "fixed").length;
const total = totalUpdated + groupResult.updated + fixedComponents + fixedGroupLinks;

if (apply) {
    console.log(`  ✅ Done.`);
    console.log(`     Products updated:        ${totalUpdated}`);
    console.log(`     Groups updated:          ${groupResult.updated}`);
    console.log(`     Components corrected:    ${fixedComponents}`);
    console.log(`     Wrong group links fixed: ${fixedGroupLinks}`);
    console.log("\n  Re-run alignment_check.mjs to verify:");
    console.log("    node scripts/alignment_check.mjs");
} else {
    console.log(`  DRY RUN complete — ${total} records would be changed.`);
    console.log("  Run with --apply to write:");
    console.log("    node scripts/run_alignment_fixes.mjs --apply");
}
