#!/usr/bin/env node
/**
 * Grace Knowledge Enrichment driver.
 *
 * Reads: data/master_v8.3_products.json
 * Calls: patchFromMasterV83:patchBatch in batches of 50
 *
 * Loads .env.local automatically.
 *
 * Usage:
 *   node scripts/patch_from_master_v83.mjs
 *
 * Safe to re-run — the underlying mutation only patches empty fields.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvLocal() {
    const envPath = path.resolve(__dirname, "..", ".env.local");
    try {
        const raw = fs.readFileSync(envPath, "utf-8");
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
    } catch {
        // Optional — env vars may already be set
    }
}

loadEnvLocal();

const CONVEX_URL =
    process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";

if (!CONVEX_URL) {
    console.error("ERROR: Set CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL) before running.");
    process.exit(1);
}

const SOURCE = path.resolve(__dirname, "..", "data", "master_v8.3_products.json");
const BATCH_SIZE = 50;

const records = JSON.parse(fs.readFileSync(SOURCE, "utf-8"));
if (!Array.isArray(records)) {
    console.error("ERROR: expected array in master_v8.3_products.json");
    process.exit(1);
}

console.log(`Loaded ${records.length} records from ${path.basename(SOURCE)}`);
console.log(`Chunking into batches of ${BATCH_SIZE}\n`);

const client = new ConvexHttpClient(CONVEX_URL);

const totals = { matched: 0, unmatched: 0, fieldsPatched: 0 };
const fieldTotals = {};
const unmatchedSamples = [];

for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);

    try {
        const result = await client.action(
            api.patchFromMasterV83.patchBatch,
            { records: batch, batchIndex },
        );

        totals.matched += result.matched;
        totals.unmatched += result.unmatched;
        totals.fieldsPatched += result.fieldsPatched;
        for (const [k, v] of Object.entries(result.fieldCounts ?? {})) {
            fieldTotals[k] = (fieldTotals[k] ?? 0) + v;
        }
        if (result.unmatchedSample) {
            for (const s of result.unmatchedSample) {
                if (unmatchedSamples.length < 30) unmatchedSamples.push(s);
            }
        }

        process.stdout.write(
            `batch ${batchIndex.toString().padStart(3)} ` +
                `[${i + batch.length}/${records.length}] ` +
                `matched=${result.matched} unmatched=${result.unmatched} ` +
                `patched=${result.fieldsPatched}\n`,
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

if (Object.keys(fieldTotals).length > 0) {
    console.log("\nPatches by field:");
    const sorted = Object.entries(fieldTotals).sort((a, b) => b[1] - a[1]);
    for (const [field, count] of sorted) {
        console.log(`  ${field.padEnd(22)} +${count}`);
    }
}

if (unmatchedSamples.length > 0) {
    console.log(`\nFirst unmatched SKUs (sample, up to 10):`);
    for (const s of unmatchedSamples.slice(0, 10)) {
        console.log(`  - ${s}`);
    }
}

console.log("\nDone. Confirm with:");
console.log("  npx convex run patchFromMasterV83:enrichmentFillRates");
