#!/usr/bin/env node
/**
 * Scrape Apothecary Style Bottles category page and compare with our data.
 * Usage: node scripts/scrape_apothecary.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const URL =
  "https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/apothecary-style-bottles.php";
const OUTPUT = join(ROOT, "data", "apothecary_scrape_report.json");
const GRACE_CSV = join(ROOT, "data", "grace_products_final.csv");

async function scrape() {
  const res = await fetch(URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const html = await res.text();

  // Extract product SKUs - pattern: bold text like GB15ApthBlue, GB1ozApth, etc.
  const skuPattern = /\b(GB[A-Za-z0-9]{8,})\b/g;
  const skus = [...new Set(html.match(skuPattern) || [])].filter(
    (s) =>
      s.includes("Apth") ||
      s.includes("Pear") ||
      s.includes("Rnd") ||
      s === "GB15ApthBlue" ||
      s === "GB1ozApth" ||
      s === "GB1ozApthBlue" ||
      s === "GB1ozApthGreen" ||
      s === "GBPearClear4ozStpr" ||
      s === "GBRndClear4ozStpr"
  );

  // Refine: only apothecary-related SKUs from the page
  const apothecarySkus = [
    "GB15ApthBlue",
    "GB1ozApth",
    "GB1ozApthBlue",
    "GB1ozApthGreen",
    "GBPearClear4ozStpr",
    "GBRndClear4ozStpr",
  ].filter((s) => html.includes(s));

  const products = apothecarySkus.map((sku) => ({
    websiteSku: sku,
    outOfStock: html.includes("Out Of Stock") && (sku.includes("Pear") || sku.includes("Rnd")),
    source: "live_category_page",
  }));

  return products;
}

function loadGraceApothecary() {
  try {
    const csv = readFileSync(GRACE_CSV, "utf8");
    const lines = csv.split("\n").slice(1);
    const rows = [];
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 6) continue;
      const family = parts[4] || "";
      if (family.toLowerCase() !== "apothecary") continue;
      rows.push({
        websiteSku: parts[2] || "",
        graceSku: parts[1] || "",
        family: family,
        capacity: parts[5] || "",
      });
    }
    return rows;
  } catch {
    return [];
  }
}

async function main() {
  console.log("Scraping apothecary category page...");
  const live = await scrape();
  console.log(`  Found ${live.length} products on live page`);

  const grace = loadGraceApothecary();
  console.log(`  Found ${grace.length} Apothecary products in grace_products_final.csv`);

  const graceBySku = Object.fromEntries(grace.map((r) => [r.websiteSku.toLowerCase(), r]));
  const liveSkus = new Set(live.map((p) => p.websiteSku.toLowerCase()));

  const inBoth = [];
  const inLiveOnly = [];

  for (const p of live) {
    const skuLower = p.websiteSku.toLowerCase();
    if (graceBySku[skuLower]) {
      inBoth.push({ ...p, graceSku: graceBySku[skuLower].graceSku });
    } else {
      inLiveOnly.push(p);
    }
  }

  const inGraceOnly = grace.filter((r) => !liveSkus.has(r.websiteSku.toLowerCase()));

  const report = {
    sourceUrl: URL,
    scrapedAt: new Date().toISOString(),
    livePage: { productCount: live.length, products: live },
    ourDatabase: { apothecaryFamilyCount: grace.length, products: grace },
    gapAnalysis: {
      inBoth,
      inLiveOnlyMissingFromUs: inLiveOnly,
      inUsOnlyNotOnCategoryPage: inGraceOnly,
      summary: {
        liveTotal: live.length,
        ourApothecaryTotal: grace.length,
        missingFromUs: inLiveOnly.length,
        extraInUs: inGraceOnly.length,
      },
    },
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(report, null, 2));

  console.log(`\nReport written to ${OUTPUT}`);
  console.log("\n--- Gap Summary ---");
  console.log(`  Live page products: ${live.length}`);
  console.log(`  Our Apothecary family: ${grace.length}`);
  console.log(`  Missing from our DB (on live page): ${inLiveOnly.length}`);
  if (inLiveOnly.length) {
    inLiveOnly.forEach((p) => console.log(`    - ${p.websiteSku}`));
  }
  console.log(`  In our DB but not on this category page: ${inGraceOnly.length}`);
}

main().catch(console.error);
