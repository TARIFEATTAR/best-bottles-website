#!/usr/bin/env node
/**
 * Export all Convex products to CSV for handoff to other projects.
 *
 * Usage:
 *   node scripts/export_products_csv.mjs
 *   node scripts/export_products_csv.mjs --output data/convex_products_export.csv
 *
 * Output: data/convex_products_export_YYYYMMDD.csv (or --output path)
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").replace(/#.*$/, "").trim();
        if (key && value) process.env[key.trim()] = value;
    }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL not set. Check .env.local");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
const PAGE_SIZE = 200;

// Columns in schema order (flat fields only; components excluded for CSV brevity)
const COLUMNS = [
    "productId", "websiteSku", "graceSku",
    "category", "family", "shape", "color", "capacity", "capacityMl", "capacityOz",
    "applicator", "capColor", "trimColor", "capStyle", "capHeight", "ballMaterial",
    "neckThreadSize", "heightWithCap", "heightWithoutCap", "diameter", "bottleWeightG", "caseQuantity",
    "qbPrice", "webPrice1pc", "webPrice10pc", "webPrice12pc",
    "stockStatus", "itemName", "itemDescription", "imageUrl", "productUrl", "dataGrade", "bottleCollection",
    "fitmentStatus", "graceDescription", "assemblyType", "componentGroup",
    "verified", "importSource",
];

function escapeCsv(val) {
    if (val == null || val === "") return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function rowToCsv(p) {
    return COLUMNS.map((col) => escapeCsv(p[col] ?? "")).join(",");
}

async function main() {
    const args = process.argv.slice(2);
    const outIdx = args.indexOf("--output");
    const outPath = outIdx >= 0 && args[outIdx + 1]
        ? args[outIdx + 1]
        : path.join(ROOT, "data", `convex_products_export_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`);

    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    console.log("📤 Exporting Convex products to CSV...\n");

    const header = COLUMNS.join(",");
    const rows = [header];
    let cursor = null;
    let total = 0;

    while (true) {
        const result = await client.action(api.products.getProductExportPage, {
            cursor,
            numItems: PAGE_SIZE,
        });

        for (const p of result.page) {
            rows.push(rowToCsv(p));
            total++;
        }

        process.stdout.write(`\r  Fetched ${total} products...`);

        if (result.isDone) break;
        cursor = result.continueCursor;
    }

    fs.writeFileSync(outPath, rows.join("\n"), "utf-8");
    console.log(`\n\n✅ Exported ${total} products to:\n   ${outPath}\n`);
}

main().catch((err) => {
    console.error("❌ Export failed:", err.message || err);
    process.exit(1);
});
