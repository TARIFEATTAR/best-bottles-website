#!/usr/bin/env node
/**
 * Drives the backfillPhysicalSpecs:backfillBatch action in chunks.
 *
 * Reads: data/grace_products_clean.json (2,780 records)
 * Calls: backfillPhysicalSpecs:backfillBatch — 50 records per batch
 *
 * Usage:
 *   node scripts/backfill_physical_specs.mjs --dry-run  # default: print plan only
 *   node scripts/backfill_physical_specs.mjs --apply    # execute Convex backfill action batches
 *
 * Requires: CONVEX_URL env var (or your repo's .env.local already set).
 *
 * Safe to re-run. The underlying mutation only patches empty fields.
 */

import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const apply = process.argv.includes("--apply");
const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";

const SOURCE = path.resolve("data/grace_products_clean.json");
const BATCH_SIZE = 50;

const raw = fs.readFileSync(SOURCE, "utf8");
const records = JSON.parse(raw);

if (!Array.isArray(records)) {
    console.error("ERROR: expected an array in grace_products_clean.json");
    process.exit(1);
}

console.log(`Loaded ${records.length} records from ${SOURCE}`);
console.log(`Chunking into batches of ${BATCH_SIZE}\n`);

if (!apply) {
    console.log("DRY RUN: no Convex actions were called.");
    console.log(`Would process ${Math.ceil(records.length / BATCH_SIZE)} batches.`);
    console.log("Add --apply to execute the backfill.");
    process.exit(0);
}

if (!CONVEX_URL) {
    console.error("ERROR: Set CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL) before running with --apply.");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const totals = { matched: 0, unmatched: 0, fieldsPatched: 0 };
const unmatchedSamples = [];

for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);

    try {
        // Note: api.backfillPhysicalSpecs.backfillBatch is an action
        const result = await client.action(
            api.backfillPhysicalSpecs.backfillBatch,
            { records: batch, batchIndex }
        );

        totals.matched += result.matched;
        totals.unmatched += result.unmatched;
        totals.fieldsPatched += result.fieldsPatched;
        if (result.unmatchedSample) {
            for (const s of result.unmatchedSample) {
                if (unmatchedSamples.length < 30) unmatchedSamples.push(s);
            }
        }

        process.stdout.write(
            `batch ${batchIndex.toString().padStart(3)} ` +
                `[${i + batch.length}/${records.length}] ` +
                `matched=${result.matched} unmatched=${result.unmatched} ` +
                `patched=${result.fieldsPatched}\n`
        );
    } catch (err) {
        console.error(`batch ${batchIndex} FAILED:`, err.message);
        process.exit(1);
    }
}

console.log("\n─── SUMMARY ─────────────────────────────────────");
console.log(`Total records processed:  ${records.length}`);
console.log(`Matched to Convex doc:    ${totals.matched}`);
console.log(`Unmatched (no Convex):    ${totals.unmatched}`);
console.log(`Total fields patched:     ${totals.fieldsPatched}`);
if (unmatchedSamples.length > 0) {
    console.log(`\nFirst unmatched SKUs (sample):`);
    for (const s of unmatchedSamples.slice(0, 10)) {
        console.log(`  - ${s}`);
    }
}
console.log("\nDone. Run the fillRateReport to confirm:");
console.log("  npx convex run backfillPhysicalSpecs:fillRateReport");
