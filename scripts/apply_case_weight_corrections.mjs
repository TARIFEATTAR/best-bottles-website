#!/usr/bin/env node
/**
 * Apply corrected caseWeightG / bottleWeightG / caseQuantity values
 * from data/case_weight_corrections.json to the products table.
 *
 * Overwrites existing values (these are authoritative corrections).
 *
 * CONVEX_URL controls the target. Pass via env:
 *   CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/apply_case_weight_corrections.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
    const envPath = path.resolve(__dirname, "..", ".env.local");
    try {
        const raw = fs.readFileSync(envPath, "utf-8");
        for (const line of raw.split("\n")) {
            const t = line.trim();
            if (!t || t.startsWith("#")) continue;
            const i = t.indexOf("=");
            if (i < 0) continue;
            const k = t.slice(0, i).trim();
            let v = t.slice(i + 1).trim();
            if (v.includes("#")) v = v.slice(0, v.indexOf("#")).trim();
            v = v.replace(/^["']|["']$/g, "");
            if (!process.env[k]) process.env[k] = v;
        }
    } catch {}
}
loadEnvLocal();

const URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
if (!URL) {
    console.error("Missing CONVEX_URL / NEXT_PUBLIC_CONVEX_URL");
    process.exit(1);
}
console.log(`Target: ${URL}`);

const SRC = path.resolve(__dirname, "..", "data", "case_weight_corrections.json");
const records = JSON.parse(fs.readFileSync(SRC, "utf-8"));
const BATCH = 50;
console.log(`Loaded ${records.length} corrections\n`);

const client = new ConvexHttpClient(URL);
const totals = { matched: 0, unmatched: 0, overwritten: 0 };
const fieldTotals = {};
const unmatchedSamples = [];

for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const batchIndex = Math.floor(i / BATCH);
    const r = await client.action(
        api.applyCaseWeightCorrections.applyBatch,
        { records: batch, batchIndex },
    );
    totals.matched += r.matched;
    totals.unmatched += r.unmatched;
    totals.overwritten += r.overwritten;
    for (const [k, v] of Object.entries(r.counts ?? {})) {
        fieldTotals[k] = (fieldTotals[k] ?? 0) + v;
    }
    for (const s of r.unmatchedSample ?? []) {
        if (unmatchedSamples.length < 30) unmatchedSamples.push(s);
    }
    process.stdout.write(
        `batch ${batchIndex.toString().padStart(3)} [${i + batch.length}/${records.length}] matched=${r.matched} unmatched=${r.unmatched} overwrote=${r.overwritten}\n`,
    );
}

console.log(`\n─── Summary ───`);
console.log(`Matched:    ${totals.matched}`);
console.log(`Unmatched:  ${totals.unmatched}`);
console.log(`Overwrote:  ${totals.overwritten} fields`);
console.log("By field:");
for (const [k, v] of Object.entries(fieldTotals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} +${v}`);
}
if (unmatchedSamples.length) {
    console.log("\nSample unmatched SKUs:");
    for (const s of unmatchedSamples.slice(0, 10)) console.log(`  - ${s}`);
}
