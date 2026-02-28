#!/usr/bin/env node
/**
 * Normalize "Blue" → "Cobalt Blue" color values across all products.
 * Grace SKUs remain unchanged (BLU and CBL segments both valid).
 * After running, rebuild product groups to consolidate siblings.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
} catch { /* .env.local is optional */ }

import { api } from "../convex/_generated/api.js";
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

console.log("Running normalizeBlueColorVariants migration...\n");

try {
    let totalUpdated = 0;
    let totalScanned = 0;
    let hasMore = true;
    let cursor = undefined;
    let batchNum = 1;

    while (hasMore) {
        console.log(`Processing batch ${batchNum}...`);
        const result = await client.mutation(api.migrations.normalizeBlueColorVariants, { 
            cursor,
            batchSize: 200 
        });
        totalUpdated += result.updated;
        totalScanned += result.scanned ?? 0;
        hasMore = result.hasMore;
        cursor = result.nextCursor;
        console.log(`  Scanned ${result.scanned ?? "?"} products, updated ${result.updated}`);
        batchNum++;
    }

    console.log(`\n✅ Complete! Normalized ${totalUpdated} total products from "Blue" → "Cobalt Blue".`);
    console.log(`   Scanned ${totalScanned} products across ${batchNum - 1} batches.`);
    console.log("\nNext steps:");
    console.log("1. Run buildProductGroups to consolidate sibling groups");
    console.log("2. Run linkProductsToGroups to update FK references");
    console.log("\nOr run: node scripts/run_grouping_migration.mjs");
} catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
}
