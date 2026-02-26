#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/grace_products_final.json"), "utf-8"));

// Find all 9ml Cylinder roller products
const cyl9 = data.filter((p) =>
  p.family === "Cylinder" &&
  (p.capacity || "").includes("9 ml") &&
  ["ROL", "RON", "MRL", "MRO"].includes((p.grace_sku || "").split("-")[4])
);

console.log("9ml Cylinder roller variants found:", cyl9.length);
for (const p of cyl9) {
  console.log(`  ${p.grace_sku} — ${p.capacity} — ${p.neck_thread_size} — ${(p.compatible_components||[]).length} components`);
}

// Pick the clear plastic roller
const pick = cyl9.find((p) => p.grace_sku.includes("CLR")) || cyl9[0];
if (!pick) { console.log("None found"); process.exit(1); }

console.log("\n=== SELECTED:", pick.grace_sku, "===");
console.log("Thread:", pick.neck_thread_size);
console.log("Price:", pick.price_1);
console.log("Total components:", (pick.compatible_components || []).length);

const comps = pick.compatible_components || [];
const byType = {};
for (const c of comps) {
  const sku = c.grace_sku || "";
  const typeCode = sku.split("-")[1] || "?";
  const typeMap = { DRP: "Dropper", ROC: "Roller Cap", SPR: "Sprayer", LPM: "Lotion Pump", CAP: "Cap" };
  const type = typeMap[typeCode] || typeCode;
  if (!byType[type]) byType[type] = [];
  byType[type].push({ sku, name: c.item_name || "" });
}

for (const [type, items] of Object.entries(byType)) {
  console.log(`\n${type} (${items.length}):`);
  for (const item of items) {
    console.log(`  ${item.sku}`);
    console.log(`    ${item.name.substring(0, 90)}`);
  }
}
