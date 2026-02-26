#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../data/grace_products_final.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

// Pick one representative product from each of 10 families with varied applicators
const targets = [
  { family: "Boston Round", appCode: "ROL" },
  { family: "Boston Round", appCode: "MRO" },
  { family: "Circle",       appCode: "SPR" },
  { family: "Round",        appCode: "LPM" },
  { family: "Elegant",      appCode: "ROL" },
  { family: "Cylinder",     appCode: "DRP" },
  { family: "Diva",         appCode: "SPR" },
  { family: "Empire",       appCode: "ROL" },
  { family: "Sleek",        appCode: "SPR" },
  { family: "Grace",        appCode: "LPM" },
];

const results = [];
for (const { family, appCode } of targets) {
  const matches = data.filter(
    (p) =>
      p.family === family &&
      (p.grace_sku || "").split("-")[4] === appCode &&
      p.compatible_components &&
      p.compatible_components.length > 0
  );

  const pick = matches.length > 0
    ? matches[0]
    : data.find((p) => p.family === family && p.compatible_components && p.compatible_components.length > 0);

  if (pick) results.push(pick);
}

// Format output
for (const p of results) {
  const parts = (p.grace_sku || "").split("-");
  const colorCode = parts[2] || "?";
  const appCode   = parts[4] || "?";

  const compByType = {};
  for (const comp of (p.compatible_components || [])) {
    const t = comp.type || "unknown";
    if (!compByType[t]) compByType[t] = [];
    compByType[t].push(comp.sku || comp.website_sku || comp.grace_sku || "?");
  }

  console.log(JSON.stringify({
    family: p.family,
    graceSku: p.grace_sku,
    websiteSku: p.website_sku,
    itemName: (p.item_name || "").substring(0, 70),
    neckThread: p.neck_thread_size,
    capacity: p.capacity,
    colorCode,
    appCode,
    price1: p.price_1,
    totalComponents: (p.compatible_components || []).length,
    componentsByType: compByType,
  }, null, 2));
  console.log("---");
}
