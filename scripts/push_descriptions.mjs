#!/usr/bin/env node
/**
 * Push enhanced product descriptions to Convex.
 *
 * Reads data/description_patches.json, splits into batches of 50,
 * and calls products.patchDescriptions for each batch.
 *
 * Usage:
 *   node scripts/push_descriptions.mjs             # live push
 *   node scripts/push_descriptions.mjs --dry-run   # preview counts, no writes
 *
 * The JSON is keyed by websiteSku and each entry has:
 *   { websiteSku, graceSku, family, original_itemDescription, enhanced_itemDescription }
 *
 * Only enhanced_itemDescription is written to Convex (as itemDescription).
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PATCHES_PATH = path.join(ROOT, "data", "description_patches.json");
const BATCH_SIZE = 50;

// ─── Load .env.local ──────────────────────────────────────────────────────────
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").replace(/#.*$/, "").trim();
        if (key && value) process.env[key.trim()] = value;
    }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("❌  NEXT_PUBLIC_CONVEX_URL not set. Check .env.local");
    process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");

// ─── Load patches ─────────────────────────────────────────────────────────────
if (!fs.existsSync(PATCHES_PATH)) {
    console.error(`❌  Patches file not found: ${PATCHES_PATH}`);
    process.exit(1);
}

const json = JSON.parse(fs.readFileSync(PATCHES_PATH, "utf-8"));
const { meta, patches } = json;

// Build flat array of { websiteSku, itemDescription }
const allPatches = Object.values(patches).map((entry) => ({
    websiteSku: entry.websiteSku,
    itemDescription: entry.enhanced_itemDescription,
}));

// Split into batches
const batches = [];
for (let i = 0; i < allPatches.length; i += BATCH_SIZE) {
    batches.push(allPatches.slice(i, i + BATCH_SIZE));
}

// ─── Preview ──────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════════╗");
console.log("║  Best Bottles — Push Enhanced Descriptions          ║");
console.log("╚══════════════════════════════════════════════════════╝\n");
console.log(`  Source:    ${PATCHES_PATH}`);
console.log(`  Generated: ${meta?.generated_at ?? "unknown"}`);
console.log(`  Model:     ${meta?.model ?? "unknown"}`);
console.log(`  Patches:   ${allPatches.length} products`);
console.log(`  Batches:   ${batches.length} × ${BATCH_SIZE}`);

if (isDryRun) {
    console.log("\n  ⚠️  DRY RUN — no writes will be made.\n");
    for (let i = 0; i < Math.min(3, allPatches.length); i++) {
        const p = allPatches[i];
        console.log(`  [${p.websiteSku}]`);
        console.log(`    → ${p.itemDescription.slice(0, 100)}…\n`);
    }
    if (allPatches.length > 3) {
        console.log(`  … and ${allPatches.length - 3} more.\n`);
    }
    console.log("  Run without --dry-run to push to Convex.\n");
    process.exit(0);
}

// ─── Push ─────────────────────────────────────────────────────────────────────
console.log("\nPushing to Convex...\n");

const client = new ConvexHttpClient(CONVEX_URL);

let totalUpdated = 0;
let totalNotFound = [];

for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;

    try {
        const result = await client.mutation(api.products.patchDescriptions, {
            patches: batch,
        });

        totalUpdated += result.updated;
        totalNotFound = totalNotFound.concat(result.notFound);

        const pct = Math.round((batchNum / batches.length) * 100);
        const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
        process.stdout.write(
            `\r  [${bar}] ${pct}%  batch ${batchNum}/${batches.length}  (${totalUpdated} updated)`
        );
    } catch (err) {
        console.error(`\n\n❌  Batch ${batchNum} failed: ${err.message || err}`);
        console.error("   Stopping. Re-run to retry — already-patched records will simply overwrite with the same value.\n");
        process.exit(1);
    }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("\n");
console.log("╔══════════════════════════════════════════════════════╗");
console.log("║  Done                                               ║");
console.log("╚══════════════════════════════════════════════════════╝");
console.log(`\n  ✅  Updated:   ${totalUpdated} products`);

if (totalNotFound.length > 0) {
    console.log(`  ⚠️   Not found: ${totalNotFound.length} SKUs (no matching product in Convex)`);
    console.log("\n  Missing SKUs:");
    for (const sku of totalNotFound) {
        console.log(`    • ${sku}`);
    }
} else {
    console.log(`  ✅  Not found:  0 (all SKUs matched)`);
}

console.log();
