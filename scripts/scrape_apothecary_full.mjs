#!/usr/bin/env node
/**
 * Apothecary Broader Scrape
 * Fetches all apothecary-style product URLs from firecrawl, scrapes each page,
 * compares against grace_products data, produces full report.
 *
 * Usage: node scripts/scrape_apothecary_full.mjs
 * Output: data/apothecary_full_report.json, docs/APOTHECARY_FULL_REPORT.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DELAY_MS = 1200;

const SPEC_LABELS = [
  "Item Type",
  "Item Name",
  "Item Description",
  "Item Capacity",
  "Item Height with Cap",
  "Item Height without Cap",
  "Item Diameter",
  "Item Width",
  "Item Depth",
  "Neck Thread Size",
  "Closure Type",
];

function extractSpecs(text) {
  const data = {};
  for (const label of SPEC_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const stopPattern = SPEC_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const re = new RegExp(
      `${escaped}:\\s*([\\s\\S]+?)(?=(?:${stopPattern}):|1\\s*pcs?\\s*[-–]|$)`,
      "i"
    );
    const m = text.match(re);
    if (m) {
      let value = m[1].replace(/\s+/g, " ").trim();
      value = value.replace(/\s*Purchase:.*$/i, "").replace(/\s*Nemat International.*$/i, "").trim();
      const field = label
        .replace(/^Item\s+/i, "")
        .replace(/\s+/g, "")
        .replace(/^([a-z])/, (_, c) => c.toLowerCase());
      const key =
        field === "name"
          ? "itemName"
          : field === "description"
            ? "itemDescription"
            : field === "capacity"
              ? "capacity"
              : field === "heightwithcap"
                ? "heightWithCap"
                : field === "heightwithoutcap"
                  ? "heightWithoutCap"
                  : field === "diameter"
                    ? "diameter"
                    : field === "width"
                      ? "width"
                      : field === "depth"
                        ? "depth"
                        : field === "neckthreadsize"
                          ? "neckThreadSize"
                          : field === "closuretype"
                            ? "closureType"
                            : field === "itemtype"
                              ? "itemType"
                              : field;
      if (value) {
        data[key] = value;
        if (label === "Item Name") data.websiteSku = value;
      }
    }
  }
  return data;
}

async function scrapeProductPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (res.status === 404) return { error: "404 — page not found" };
    if (res.status !== 200) return { error: `HTTP ${res.status}` };

    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const data = { url, scraped_ok: true };
    Object.assign(data, extractSpecs(text));

    if (data.itemName === undefined) {
      const itemNameM = html.match(/Item Name:\s*([^\s<]+)/i);
      if (itemNameM) data.websiteSku = itemNameM[1].trim();
    } else {
      data.websiteSku = data.itemName;
    }
    const itemNameM = text.match(/Item Name:\s*([^\s<]+)/i);
    if (itemNameM && !data.websiteSku) data.websiteSku = itemNameM[1].trim();

    const price1 = text.match(/1\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*\/\s*pc/i);
    if (price1) data.webPrice1pc = parseFloat(price1[1]);
    const price12 = text.match(/12\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*\/\s*pc/i);
    if (price12) data.webPrice12pc = parseFloat(price12[1]);

    if (text.includes("no longer available") || text.includes("Sorry this product is no longer available for purchase")) {
      data.stockStatus = "no longer available";
    } else if (text.includes("Out Of Stock") || text.includes("Out of Stock")) {
      data.stockStatus = "Out of Stock";
    } else {
      data.stockStatus = "In Stock";
    }

    const imgM = html.match(/src="([^"]*store\/enlarged_pics\/[^"]+)"/);
    if (imgM) {
      let src = imgM[1];
      if (src.startsWith("/")) src = "https://www.bestbottles.com" + src;
      else if (src.startsWith("..")) src = "https://www.bestbottles.com" + src.replace(/^\.\./, "");
      data.imageUrl = src;
    }

    return data;
  } catch (e) {
    return { url, error: e.message || "Connection failed" };
  }
}

function loadGraceProducts() {
  const csv = readFileSync(join(ROOT, "data", "grace_products_final.csv"), "utf8");
  const lines = csv.split("\n").slice(1);
  const products = [];
  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length < 15) continue;
    const [id, graceSku, websiteSku, category, family, capacity, neckThreadSize, itemName, itemDescription, imageUrl, price1, price10, price12, inStock, productUrl] = parts;
    products.push({
      id,
      graceSku,
      websiteSku: websiteSku || "",
      category,
      family,
      capacity,
      neckThreadSize,
      itemName,
      itemDescription,
      imageUrl,
      price1: price1 ? parseFloat(price1) : null,
      price10: price10 ? parseFloat(price10) : null,
      price12: price12 ? parseFloat(price12) : null,
      inStock,
      productUrl: productUrl || "",
    });
  }
  return products;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += c;
    } else if (c === ",") {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.href.toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase();
  }
}

function suggestGraceSku(websiteSku, scraped) {
  if (!websiteSku) return null;
  const parts = websiteSku.replace(/([a-z])([A-Z])/g, "$1-$2").split("-");
  const capacity = scraped.capacity || "";
  const mlMatch = capacity.match(/(\d+)\s*ml/i) || capacity.match(/(\d+\.?\d*)\s*oz/i);
  const ml = mlMatch ? mlMatch[1] : "??";
  const color = (websiteSku.match(/Blu|Blue|Grn|Green|Clr|Clear|Amb|Amber/i) || [""])[0];
  const colorMap = { Blu: "BLU", Blue: "BLU", Grn: "GRN", Green: "GRN", Clr: "CLR", Clear: "CLR", Amb: "AMB", Amber: "AMB" };
  const colorCode = color ? colorMap[color] || "CLR" : "CLR";
  return `GB-APT-${colorCode}-${ml}ML-T`;
}

async function main() {
  console.log("Apothecary Broader Scrape\n");

  const firecrawl = JSON.parse(
    readFileSync(join(ROOT, "data", "firecrawl_url_map.json"), "utf8")
  );
  const urls = (firecrawl.links || [])
    .map((l) => l.url)
    .filter((u) => u && /apothecary/i.test(u));
  const uniqueUrls = [...new Set(urls)];

  console.log(`Found ${uniqueUrls.length} apothecary-style URLs in firecrawl\n`);

  const grace = loadGraceProducts();
  const byUrl = new Map();
  const bySku = new Map();
  for (const p of grace) {
    const norm = normalizeUrl(p.productUrl);
    if (norm) byUrl.set(norm, p);
    if (p.websiteSku) bySku.set(p.websiteSku.toLowerCase(), p);
  }

  const products = [];
  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    console.log(`  [${i + 1}/${uniqueUrls.length}] ${url.split("/").pop()}`);
    const scraped = await scrapeProductPage(url);
    await new Promise((r) => setTimeout(r, DELAY_MS));

    let status = "missing";
    let ourData = null;
    let notes = null;

    if (scraped.error) {
      status = "scrape_error";
      notes = scraped.error;
    } else if (scraped.stockStatus === "no longer available") {
      status = "discontinued";
      notes = "Product page says no longer available";
    } else {
      const normUrl = normalizeUrl(url);
      const matchByUrl = byUrl.get(normUrl);
      const matchBySku = scraped.websiteSku ? bySku.get(scraped.websiteSku.toLowerCase()) : null;
      const match = matchByUrl || matchBySku;

      if (match) {
        ourData = {
          graceSku: match.graceSku,
          websiteSku: match.websiteSku,
          family: match.family,
          capacity: match.capacity,
          productUrl: match.productUrl,
        };
        if (match.family.toLowerCase() === "apothecary") {
          status = "match";
        } else {
          status = "misclassified";
          notes = `In DB as ${match.family}; should be Apothecary`;
        }
      } else {
        status = "missing";
        notes = "Not in our database";
      }
    }

    products.push({
      url,
      websiteSku: scraped.websiteSku || null,
      scraped: scraped.error
        ? null
        : {
            websiteSku: scraped.websiteSku,
            capacity: scraped.capacity,
            neckThreadSize: scraped.neckThreadSize,
            closureType: scraped.closureType,
            webPrice1pc: scraped.webPrice1pc,
            webPrice12pc: scraped.webPrice12pc,
            stockStatus: scraped.stockStatus,
            itemName: scraped.itemName || scraped.itemDescription?.slice(0, 100),
          },
      inOurDb: !!ourData,
      ourData,
      status,
      notes,
    });
  }

  const summary = {
    urlsScraped: uniqueUrls.length,
    scrapeSuccess: products.filter((p) => !p.scraped?.error && p.scraped).length,
    scrapeFailed: products.filter((p) => p.status === "scrape_error").length,
    inDbApothecary: products.filter((p) => p.status === "match").length,
    inDbOtherFamily: products.filter((p) => p.status === "misclassified").length,
    missingFromDb: products.filter((p) => p.status === "missing").length,
    discontinued: products.filter((p) => p.status === "discontinued").length,
  };

  const gapAnalysis = {
    missingFromDb: products
      .filter((p) => p.status === "missing" && p.scraped)
      .map((p) => ({
        url: p.url,
        scraped: p.scraped,
        suggestedGraceSku: suggestGraceSku(p.websiteSku, p.scraped),
      })),
    misclassified: products
      .filter((p) => p.status === "misclassified")
      .map((p) => ({
        url: p.url,
        websiteSku: p.websiteSku,
        currentFamily: p.ourData?.family,
        recommendedFamily: "Apothecary",
      })),
    discontinued: products
      .filter((p) => p.status === "discontinued")
      .map((p) => ({ url: p.url, scraped: p.scraped })),
  };

  const report = {
    scrapedAt: new Date().toISOString(),
    sourceUrls: uniqueUrls,
    summary,
    products,
    gapAnalysis,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  mkdirSync(join(ROOT, "docs"), { recursive: true });

  writeFileSync(
    join(ROOT, "data", "apothecary_full_report.json"),
    JSON.stringify(report, null, 2)
  );

  const md = generateMarkdown(report);
  writeFileSync(join(ROOT, "docs", "APOTHECARY_FULL_REPORT.md"), md);

  console.log(`\nReport written to data/apothecary_full_report.json`);
  console.log(`Markdown written to docs/APOTHECARY_FULL_REPORT.md`);
  console.log("\n--- Summary ---");
  console.log(`  URLs scraped: ${summary.urlsScraped}`);
  console.log(`  Scrape success: ${summary.scrapeSuccess}`);
  console.log(`  In DB (Apothecary): ${summary.inDbApothecary}`);
  console.log(`  Misclassified: ${summary.inDbOtherFamily}`);
  console.log(`  Missing from DB: ${summary.missingFromDb}`);
  console.log(`  Discontinued: ${summary.discontinued}`);
}

function generateMarkdown(report) {
  const s = report.summary;
  let md = `# Apothecary Full Report

**Scraped:** ${report.scrapedAt}  
**Source:** firecrawl_url_map.json (apothecary-style URLs)  
**Report JSON:** \`data/apothecary_full_report.json\`

---

## Executive Summary

| Metric | Count |
|--------|-------|
| URLs scraped | ${s.urlsScraped} |
| Scrape success | ${s.scrapeSuccess} |
| Scrape failed | ${s.scrapeFailed} |
| In DB (Apothecary family) | ${s.inDbApothecary} |
| In DB (other family — misclassified) | ${s.inDbOtherFamily} |
| Missing from DB | ${s.missingFromDb} |
| Discontinued | ${s.discontinued} |

---

## Product Table

| # | URL | Website SKU | Status | Our Family | Notes |
|---|-----|-------------|--------|------------|------|
`;

  report.products.forEach((p, i) => {
    const slug = p.url.split("/").pop() || p.url;
    const sku = p.websiteSku || "—";
    const family = p.ourData?.family || "—";
    const notes = p.notes || "";
    md += `| ${i + 1} | [${slug}](${p.url}) | ${sku} | ${p.status} | ${family} | ${notes} |\n`;
  });

  md += `
---

## Gap Analysis

### Missing from DB (${report.gapAnalysis.missingFromDb.length})

`; 
  if (report.gapAnalysis.missingFromDb.length === 0) {
    md += "None.\n\n";
  } else {
    report.gapAnalysis.missingFromDb.forEach((g) => {
      md += `- **${g.url}** — ${g.scraped?.itemName || g.scraped?.capacity || "—"} (suggested: ${g.suggestedGraceSku || "—"})\n`;
    });
    md += "\n";
  }

  md += `### Misclassified (${report.gapAnalysis.misclassified.length})

`;
  if (report.gapAnalysis.misclassified.length === 0) {
    md += "None.\n\n";
  } else {
    report.gapAnalysis.misclassified.forEach((g) => {
      md += `- **${g.websiteSku}** — currently ${g.currentFamily}, should be ${g.recommendedFamily}\n`;
    });
    md += "\n";
  }

  md += `### Discontinued (${report.gapAnalysis.discontinued.length})

`;
  if (report.gapAnalysis.discontinued.length === 0) {
    md += "None.\n\n";
  } else {
    report.gapAnalysis.discontinued.forEach((g) => {
      md += `- ${g.url}\n`;
    });
    md += "\n";
  }

  md += `---

## Recommended Actions

1. **Reclassify misclassified products** — Update \`family\` to \`Apothecary\` and \`bottleCollection\` to \`Apothecary Collection\` for products listed in "Misclassified" above.
2. **Add missing products** — Create Convex migration or seed script to add products from "Missing from DB" (scrape full specs first if needed).
3. **Mark discontinued** — Optionally exclude or flag discontinued products in catalog display.

---

## Appendix

- **Script:** \`node scripts/scrape_apothecary_full.mjs\`
- **Package script:** \`npm run scrape:apothecary\`
`;

  return md;
}

main().catch(console.error);
