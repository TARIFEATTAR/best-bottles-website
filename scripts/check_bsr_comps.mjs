#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/grace_products_final.json"), "utf-8"));

const p = data.find((prod) => prod.grace_sku === "GB-BSR-AMB-30ML-RON-MGLD");
const comps = p.compatible_components || [];

const droppers = comps.filter((c) => (c.grace_sku || "").includes("DRP"));
const rollers  = comps.filter((c) => (c.grace_sku || "").includes("ROC"));
const caps     = comps.filter((c) => (c.grace_sku || "").includes("CAP"));
const sprayers = comps.filter((c) => (c.grace_sku || "").includes("SPR"));

console.log("=== DROPPERS (" + droppers.length + ") ===");
for (const c of droppers) {
  const len = (c.grace_sku || "").endsWith("-90") || (c.grace_sku || "").endsWith("90") ? "90mm" : "76mm";
  console.log(`  [${len}] ${c.grace_sku}`);
  console.log(`         ${c.item_name}`);
}

console.log("\n=== ROLLER CAPS (" + rollers.length + ") ===");
for (const c of rollers) {
  console.log(`  ${c.grace_sku}`);
  console.log(`  ${c.item_name}`);
}

console.log("\n=== PLAIN CAPS (" + caps.length + ") ===");
for (const c of caps) {
  console.log(`  ${c.grace_sku} — ${c.item_name}`);
}

console.log("\n=== SPRAYERS (" + sprayers.length + ") ===");

// Also check: do any Boston Round products have SPR applicator?
const bsrSpr = data.filter((prod) => prod.family === "Boston Round" && (prod.grace_sku || "").split("-")[4] === "SPR");
console.log("Boston Round SPR bottle SKUs:", bsrSpr.length);

// Check every component across all products for any SPR with 20400 thread
const allCompSkus = new Set();
for (const prod of data) {
  for (const c of (prod.compatible_components || [])) {
    allCompSkus.add(c.grace_sku || "");
  }
}
const spr20400 = [...allCompSkus].filter((s) => s.includes("SPR") && s.includes("20400"));
console.log("Any CMP-SPR-*-20400-* in entire dataset:", spr20400.length);
