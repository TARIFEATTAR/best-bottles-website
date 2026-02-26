#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/grace_products_final.json"), "utf-8"));

// Check a 60ml BSR product
const bsr60 = data.find((p) => p.family === "Boston Round" && (p.capacity || "").includes("60 ml") && (p.compatible_components || []).length > 0);
console.log("=== BSR 60ml sample ===");
console.log(bsr60.grace_sku, bsr60.neck_thread_size);
const skus60 = (bsr60.compatible_components || []).map((c) => c.grace_sku || "");
const drp60 = skus60.filter((s) => s.includes("DRP"));
const cap60 = skus60.filter((s) => s.includes("CAP"));
const roc60 = skus60.filter((s) => s.includes("ROC"));
console.log("Droppers:", drp60);
console.log("Caps:", cap60);
console.log("Roller caps:", roc60);

// Show what gets removed vs kept per capacity
console.log("\n=== MIGRATION PLAN — what gets removed ===");

// 15ml BSR
const bsr15 = data.filter((p) => p.family === "Boston Round" && (p.capacity || "").includes("15 ml"));
const bsr30 = data.filter((p) => p.family === "Boston Round" && (p.capacity || "").includes("30 ml"));
const bsr60all = data.filter((p) => p.family === "Boston Round" && (p.capacity || "").includes("60 ml"));

function getRemovable15(p) {
  return (p.compatible_components || []).filter((c) => (c.grace_sku || "").includes("90MM")).map((c) => c.grace_sku);
}
function getRemovable30(p) {
  return (p.compatible_components || []).filter((c) => {
    const s = c.grace_sku || "";
    return s.includes("DRP") && s.endsWith("-90") || s === "CMP-CAP-BLK-20-400-2OZ";
  }).map((c) => c.grace_sku);
}
function getRemovable60(p) {
  return (p.compatible_components || []).filter((c) => {
    const s = c.grace_sku || "";
    return (s.includes("DRP") && (s.endsWith("-76") || s.includes("-76MM"))) || s === "CMP-CAP-BLK-20-400-1OZ";
  }).map((c) => c.grace_sku);
}

const rem15 = new Set(bsr15.flatMap(getRemovable15));
const rem30 = new Set(bsr30.flatMap(getRemovable30));
const rem60 = new Set(bsr60all.flatMap(getRemovable60));

console.log(`\n15ml BSR (${bsr15.length} products) — remove these component SKUs:`);
for (const s of rem15) console.log("  -", s);

console.log(`\n30ml BSR (${bsr30.length} products) — remove these component SKUs:`);
for (const s of rem30) console.log("  -", s);

console.log(`\n60ml BSR (${bsr60all.length} products) — remove these component SKUs:`);
for (const s of rem60) console.log("  -", s);

console.log(`\nAfter fix: 15ml would have ${(bsr15[0]?.compatible_components||[]).length - rem15.size} components`);
console.log(`After fix: 30ml would have ${(bsr30[0]?.compatible_components||[]).length - rem30.size} components`);
console.log(`After fix: 60ml would have ${(bsr60all[0]?.compatible_components||[]).length - rem60.size} components`);
