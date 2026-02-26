#!/usr/bin/env node
/**
 * Comprehensive data quality scan across all 2,285 products.
 * Looks for:
 *  1. Component stem/size variants assigned to wrong bottle capacity
 *  2. Component thread mismatch vs bottle stated thread
 *  3. True duplicate component SKUs on the same product
 *  4. Any other "same finish, different size" patterns
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/grace_products_final.json"), "utf-8"));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSku(comp) {
  return comp.grace_sku || comp.sku || comp.website_sku || "";
}

function parseCapacityMl(str) {
  if (!str) return null;
  const m = str.match(/(\d+(?:\.\d+)?)\s*ml/i);
  return m ? parseFloat(m[1]) : null;
}

// Extract thread from component SKU e.g. CMP-DRP-WHT-20400-76 → "20-400"
function threadFromCompSku(sku) {
  const parts = sku.split("-");
  // Thread segment is usually 4 digits with no dash, or with a dash already
  // e.g. 20400, 18415, 17415, 13415
  for (const part of parts) {
    const clean = part.replace(/[^0-9]/g, "");
    if (clean.length === 5) {
      return clean.slice(0, 2) + "-" + clean.slice(2);
    }
  }
  return null;
}

// ─── Issue collectors ─────────────────────────────────────────────────────────

const issues = {
  stemVariants: [],      // Same finish, multiple size suffixes (like 76/90mm droppers)
  threadMismatch: [],    // Component thread ≠ bottle stated thread
  trueDuplicates: [],    // Exact same SKU twice on same product
  capSizeVariants: [],   // Cap size variants (1oz/2oz) on same product
};

for (const product of data) {
  const comps = product.compatible_components || [];
  if (comps.length === 0) continue;

  const bottleThread = (product.neck_thread_size || "").replace(/[^0-9-]/g, "");
  const capacityMl = parseCapacityMl(product.capacity);
  const skuList = comps.map(getSku);

  // ── 1. True duplicates ────────────────────────────────────────────────────
  const seen = new Set();
  for (const sku of skuList) {
    if (seen.has(sku)) {
      issues.trueDuplicates.push({
        product: product.grace_sku,
        family: product.family,
        capacity: product.capacity,
        dupSku: sku,
      });
    }
    seen.add(sku);
  }

  // ── 2. Thread mismatch ────────────────────────────────────────────────────
  for (const sku of skuList) {
    const compThread = threadFromCompSku(sku);
    if (compThread && bottleThread && compThread !== bottleThread) {
      issues.threadMismatch.push({
        product: product.grace_sku,
        family: product.family,
        capacity: product.capacity,
        bottleThread,
        compThread,
        compSku: sku,
      });
    }
  }

  // ── 3. Stem/size variants — group by base SKU (strip trailing numeric segment)
  // Detects patterns like CMP-DRP-WHT-20400-76 vs CMP-DRP-WHT-20400-90
  const baseGroups = {};
  for (const sku of skuList) {
    // Strip the last dash-segment if it's purely numeric (or like "76MM-01")
    const base = sku.replace(/-\d+(MM)?(-\d+)?$/, "");
    if (!baseGroups[base]) baseGroups[base] = [];
    baseGroups[base].push(sku);
  }
  for (const [base, variants] of Object.entries(baseGroups)) {
    if (variants.length > 1) {
      issues.stemVariants.push({
        product: product.grace_sku,
        family: product.family,
        capacity: product.capacity,
        capacityMl,
        base,
        variants,
      });
    }
  }

  // ── 4. Cap size variants — look for OZ suffix variants
  const capSkus = skuList.filter((s) => s.includes("CAP"));
  const capBaseGroups = {};
  for (const sku of capSkus) {
    const base = sku.replace(/-\d+OZ$/, "");
    if (!capBaseGroups[base]) capBaseGroups[base] = [];
    capBaseGroups[base].push(sku);
  }
  for (const [base, variants] of Object.entries(capBaseGroups)) {
    if (variants.length > 1) {
      issues.capSizeVariants.push({
        product: product.grace_sku,
        family: product.family,
        capacity: product.capacity,
        capacityMl,
        base,
        variants,
      });
    }
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log("=".repeat(70));
console.log("DATA QUALITY SCAN REPORT");
console.log("=".repeat(70));

// True duplicates
console.log(`\n[1] TRUE DUPLICATE COMPONENT SKUs: ${issues.trueDuplicates.length}`);
if (issues.trueDuplicates.length) {
  for (const i of issues.trueDuplicates) {
    console.log(`  ${i.product} (${i.family}, ${i.capacity}) → DUP: ${i.dupSku}`);
  }
}

// Thread mismatches — summarize by family
console.log(`\n[2] THREAD MISMATCHES (bottle thread ≠ component thread): ${issues.threadMismatch.length} instances`);
const threadByFamily = {};
for (const i of issues.threadMismatch) {
  const key = `${i.family} | bottle:${i.bottleThread} comp:${i.compThread}`;
  if (!threadByFamily[key]) threadByFamily[key] = new Set();
  threadByFamily[key].add(i.product);
}
for (const [key, products] of Object.entries(threadByFamily)) {
  console.log(`  ${key} → ${products.size} products affected`);
}

// Stem variants — summarize by family
console.log(`\n[3] STEM/SIZE VARIANTS (same base SKU, multiple size suffixes): ${issues.stemVariants.length} instances`);
const stemByFamily = {};
for (const i of issues.stemVariants) {
  if (!stemByFamily[i.family]) stemByFamily[i.family] = new Set();
  stemByFamily[i.family].add(i.product);
}
for (const [family, products] of Object.entries(stemByFamily)) {
  // Show one example
  const ex = issues.stemVariants.find((i) => i.family === family);
  console.log(`  ${family}: ${products.size} products — e.g. ${ex.base} → [${ex.variants.join(", ")}]`);
}

// Cap size variants
console.log(`\n[4] CAP SIZE VARIANTS (1oz/2oz or similar on same product): ${issues.capSizeVariants.length} instances`);
const capByFamily = {};
for (const i of issues.capSizeVariants) {
  if (!capByFamily[i.family]) capByFamily[i.family] = new Set();
  capByFamily[i.family].add(i.product);
}
for (const [family, products] of Object.entries(capByFamily)) {
  const ex = issues.capSizeVariants.find((i) => i.family === family);
  console.log(`  ${family}: ${products.size} products — e.g. [${ex.variants.join(", ")}]`);
}

// Summary
console.log("\n" + "=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`  True duplicates:    ${issues.trueDuplicates.length} instances`);
console.log(`  Thread mismatches:  ${issues.threadMismatch.length} component-level instances`);
console.log(`  Stem/size variants: ${issues.stemVariants.length} instances across ${Object.keys(stemByFamily).length} families`);
console.log(`  Cap size variants:  ${issues.capSizeVariants.length} instances across ${Object.keys(capByFamily).length} families`);
console.log(`\n  Products with NO issues: approx. ${data.filter(p => (p.compatible_components||[]).length > 0).length} have components`);
