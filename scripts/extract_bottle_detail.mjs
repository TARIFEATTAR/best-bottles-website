#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../data/grace_products_final.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

// Decode component SKU → human-readable label
// Format: CMP-{TYPE}-{FINISH}-{THREAD}-{VARIANT}
function decodeComponent(sku) {
  const parts = sku.split("-");
  if (parts[0] !== "CMP") return { type: "unknown", label: sku };

  const typeCode = parts[1];
  const finishCode = parts[2];

  const typeMap = {
    DRP: "Dropper",
    ROC: "Roller Cap",
    SPR: "Sprayer",
    LPM: "Lotion Pump",
    CAP: "Cap",
    RBL: "Roller Ball",
  };

  const finishMap = {
    WHT: "White", BLK: "Black", GLD: "Gold", SLV: "Silver",
    MSLV: "Matte Silver", MTSL: "Matte Silver",
    MGLD: "Matte Gold", MTGD: "Matte Gold",
    SGLD: "Shiny Gold", SHGD: "Shiny Gold",
    SSLV: "Shiny Silver", SHSL: "Shiny Silver",
    MBLK: "Matte Black", MTBK: "Matte Black", SHBK: "Shiny Black",
    SBLK: "Shiny Black",
    WTGD: "White Gold-Trim", BKGD: "Black Gold-Trim",
    WTSL: "White Silver-Trim", BKSL: "Black Silver-Trim",
    WTGD: "White Gold-Trim",
    MCPR: "Matte Copper", CPR: "Copper",
    LVSL: "Lavender Silver", LVSLWH: "Lavender Silver + White Tube",
    IVSL: "Ivory Silver", IVSLWH: "Ivory Silver + White Tube",
    RDSL: "Red Silver", RDSLWH: "Red Silver + White Tube",
    GDIV: "Gold Ivory", GDIVSLWH: "Gold Ivory + White Tube",
    SLWH: "Silver + White Tube", MTSLWH: "Matte Silver + White Tube",
    BKSLWH: "Black Silver + White Tube",
    GDPKSLWH: "Gold Pink + White Tube",
    MTCP: "Matte Copper",
    COCP: "Copper Over Cap",
    MTBL: "Matte Blue", MTBK: "Matte Black",
    SBLK: "Shiny Black", RED: "Red",
    PNK: "Pink", IVY: "Ivory",
    BRN: "Brown", LBRN: "Light Brown",
    TSL: "Tassel Silver",
    CLR: "Clear",
    DOT: "Dotted",
  };

  const typeName = typeMap[typeCode] || typeCode;
  const finishName = finishMap[finishCode] || finishCode;

  return {
    type: typeName,
    finish: finishName,
    label: `${finishName} ${typeName}`,
    sku,
  };
}

// Find two bottles to detail
const targets = [
  "GB-BSR-AMB-30ML-RON-MGLD",  // Boston Round 30ml Amber Plastic Roller
  "GB-ELG-CLR-15ML-ROL-SSLV",  // Elegant 15ml Clear Plastic Roller
];

for (const graceSku of targets) {
  const product = data.find((p) => p.grace_sku === graceSku);
  if (!product) { console.log(`NOT FOUND: ${graceSku}`); continue; }

  const components = (product.compatible_components || []).map((comp) => {
    const sku = comp.sku || comp.website_sku || comp.grace_sku || "";
    return decodeComponent(sku);
  });

  // Group by type
  const byType = {};
  for (const c of components) {
    if (!byType[c.type]) byType[c.type] = [];
    byType[c.type].push(c);
  }

  console.log("=== " + graceSku + " ===");
  console.log("Family:", product.family);
  console.log("Item:", product.item_name?.substring(0, 80));
  console.log("Thread:", product.neck_thread_size);
  console.log("Capacity:", product.capacity);
  console.log("Price:", product.price_1);
  console.log("Total components:", components.length);
  console.log("By type:");
  for (const [type, comps] of Object.entries(byType)) {
    console.log(`  ${type} (${comps.length}):`);
    for (const c of comps) {
      console.log(`    - ${c.label}  [${c.sku}]`);
    }
  }
  console.log("");
}
