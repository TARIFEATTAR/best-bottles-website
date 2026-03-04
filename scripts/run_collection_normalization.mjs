#!/usr/bin/env node
/**
 * run_collection_normalization.mjs
 *
 * Two fixes in one pass:
 *  1. Orphan SKUs — assign missing family + bottleCollection
 *  2. Normalize all "X Collection" / "Vial & Sample Collection" → bare family name
 *
 * Dry-run by default. Pass --apply to write to Convex.
 *
 * Usage:
 *   node scripts/run_collection_normalization.mjs           # dry-run
 *   node scripts/run_collection_normalization.mjs --apply   # apply to Convex
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────

const COLLECTION_STRIP_MAP = {
  "Bell Collection": "Bell",
  "Cylinder Collection": "Cylinder",
  "Flair Collection": "Flair",
  "Pillar Collection": "Pillar",
  "Royal Collection": "Royal",
  "Square Collection": "Square",
  "Tulip Collection": "Tulip",
  "Vial & Sample Collection": "Vial",
};

// SKUs with no family or bottleCollection at all
const ORPHAN_PATCHES = [
  {
    websiteSku: "Alu250SpryBl",
    set: { family: "Aluminum Bottle", bottleCollection: "Aluminum Bottle" },
  },
  {
    websiteSku: "CreamJarAmb5mlSlcap",
    set: { family: "Cream Jar", bottleCollection: "Cream Jar" },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadEnvLocal() {
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
  } catch {
    // Optional when env is already loaded.
  }
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function parseCSV(text) {
  const rows = [];
  const lines = text.split("\n");
  let headers = null;
  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    if (!headers) { headers = cols; }
    else {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
      rows.push(obj);
    }
  }
  return rows;
}

// ─── Build patch list ─────────────────────────────────────────────────────────

const csvPath = resolve(__dirname, "..", "data", "convex_products_export_20260228.csv");
const products = parseCSV(readFileSync(csvPath, "utf-8"));

const collectionPatches = [];
for (const p of products) {
  const normalized = COLLECTION_STRIP_MAP[p.bottleCollection];
  if (normalized) {
    collectionPatches.push({ websiteSku: p.websiteSku, set: { bottleCollection: normalized } });
  }
}

const allPatches = [...ORPHAN_PATCHES, ...collectionPatches];

// ─── Preview ─────────────────────────────────────────────────────────────────

console.log(`\n=== Orphan patches (${ORPHAN_PATCHES.length}) ===`);
for (const p of ORPHAN_PATCHES) {
  console.log(`  ${p.websiteSku}: ${JSON.stringify(p.set)}`);
}

console.log(`\n=== Collection normalization (${collectionPatches.length} SKUs) ===`);
const byTarget = {};
for (const p of collectionPatches) {
  const t = p.set.bottleCollection;
  if (!byTarget[t]) byTarget[t] = [];
  byTarget[t].push(p.websiteSku);
}
for (const [target, skus] of Object.entries(byTarget).sort()) {
  console.log(`  → "${target}": ${skus.length} SKUs`);
}

console.log(`\nTotal patches: ${allPatches.length}`);

// ─── Apply ───────────────────────────────────────────────────────────────────

const apply = process.argv.includes("--apply");

if (!apply) {
  console.log("\nDry-run only. Re-run with --apply to write to Convex.");
  process.exit(0);
}

loadEnvLocal();
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in environment or .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);
let totalUpdated = 0;
let totalMissing = 0;
let totalSkipped = 0;
let batchNo = 1;

for (const batch of chunk(allPatches, 50)) {
  const result = await client.mutation(api.migrations.applySafeWebsiteSkuPatches, {
    patches: batch,
  });
  totalUpdated += result.updatedCount ?? 0;
  totalMissing += result.missingSkus?.length ?? 0;
  totalSkipped += result.skippedCount ?? 0;
  console.log(
    `Batch ${batchNo}: updated=${result.updatedCount ?? 0} ` +
    `missing=${result.missingSkus?.length ?? 0} ` +
    `skipped=${result.skippedCount ?? 0}`
  );
  if (result.missingSkus?.length) {
    console.log("  Missing SKUs:", result.missingSkus);
  }
  batchNo++;
}

console.log(
  `\nDone. updated=${totalUpdated} missing=${totalMissing} skipped=${totalSkipped}`
);
