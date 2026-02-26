#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/grace_products_final.json"), "utf-8"));

const allComps = new Map();
for (const prod of data) {
  for (const c of (prod.compatible_components || [])) {
    const sku = c.grace_sku || "";
    if (sku && !allComps.has(sku)) allComps.set(sku, c);
  }
}

// Print item_name + price for every unique 18-415 sprayer, grouped by suffix
console.log("=== EVERY UNIQUE 18-415 SPRAYER — NAME + PRICE ===\n");
const spr18 = [...allComps.entries()]
  .filter(([sku]) => sku.includes("SPR") && sku.includes("18-415"))
  .sort(([a], [b]) => a.localeCompare(b));

const bySuffix = {};
for (const [sku, comp] of spr18) {
  const parts = sku.split("-");
  const suffix = parts[parts.length - 1];
  if (!bySuffix[suffix]) bySuffix[suffix] = [];
  bySuffix[suffix].push({ sku, name: comp.item_name || "", price: comp.price_1 });
}

for (const [suffix, items] of Object.entries(bySuffix).sort()) {
  console.log(`--- Suffix -${suffix} ---`);
  for (const { sku, name, price } of items) {
    console.log(`  $${price}  ${sku}`);
    console.log(`         ${name}`);
  }
  console.log();
}
