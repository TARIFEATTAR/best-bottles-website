#!/usr/bin/env node
/**
 * Seed script — imports grace_products_clean.json and grace_fitment.json into Convex.
 * 
 * Usage:
 *   node scripts/seed.mjs
 *   node scripts/seed.mjs --products-only
 *   node scripts/seed.mjs --fitments-only
 *   node scripts/seed.mjs --clear-first
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Load .env.local ─────────────────────────────────────────────────────────
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").replace(/#.*$/, "").trim(); // strip inline comments
        if (key && value) process.env[key.trim()] = value;
    }
}

// ─── Config ──────────────────────────────────────────────────────────────────
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL not set. Check .env.local");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
const BATCH_SIZE = 25; // Products per batch to stay under Convex size limits
const args = process.argv.slice(2);
const clearFirst = args.includes("--clear-first");
const productsOnly = args.includes("--products-only");
const fitmentsOnly = args.includes("--fitments-only");

// ─── Field normalizer ─────────────────────────────────────────────────────────
// grace_products_final.json uses snake_case; schema expects camelCase.
// This function maps the JSON format to the Convex schema format.
function normalizeProduct(raw) {
    // Parse capacityMl and capacityOz from strings like "5 ml (0.17 oz)"
    let capacityMl = null;
    let capacityOz = null;
    if (raw.capacity) {
        const mlMatch = String(raw.capacity).match(/^([\d.]+)\s*ml/i);
        const ozMatch = String(raw.capacity).match(/\(([\d.]+)\s*oz\)/i);
        if (mlMatch) capacityMl = parseFloat(mlMatch[1]);
        if (ozMatch) capacityOz = parseFloat(ozMatch[1]);
    }

    // Convert price fields — treat non-numeric values as null
    const toPrice = (v) => (typeof v === "number" && isFinite(v) ? v : null);

    // Tulip fix: source data incorrectly has family "Cylinder" for Tulip bottles
    const sku = (raw.website_sku || "").toLowerCase();
    const name = (raw.item_name || "").toLowerCase();
    const isTulip = sku.includes("tulip") || name.includes("tulip design");
    const family = isTulip ? "Tulip" : (raw.family || null);
    const bottleCollection = isTulip ? "Tulip Collection" : (raw.family || null);

    return {
        // ── Identity ───────────────────────────────────────────────
        productId:       raw.id || null,
        websiteSku:      raw.website_sku || "",
        graceSku:        raw.grace_sku || "",

        // ── Classification ─────────────────────────────────────────
        category:        raw.category || "Unknown",
        family,
        shape:           null,   // not in this dataset
        color:           null,   // not in this dataset
        capacity:        raw.capacity || null,
        capacityMl:      capacityMl,
        capacityOz:      capacityOz,

        // ── Applicator & Cap ───────────────────────────────────────
        applicator:      null,   // not in this dataset
        capColor:        null,
        trimColor:       null,
        capStyle:        null,

        // ── Physical ───────────────────────────────────────────────
        neckThreadSize:  raw.neck_thread_size || null,
        heightWithCap:   null,
        heightWithoutCap: null,
        diameter:        null,
        bottleWeightG:   null,
        caseQuantity:    null,

        // ── Pricing ────────────────────────────────────────────────
        qbPrice:         null,
        webPrice1pc:     toPrice(raw.price_1),
        webPrice10pc:    toPrice(raw.price_10),
        webPrice12pc:    toPrice(raw.price_12),

        // ── Content & Status ───────────────────────────────────────
        stockStatus:     raw.in_stock === true ? "In Stock" : raw.in_stock === false ? "Out of Stock" : null,
        itemName:        raw.item_name || "",
        itemDescription: raw.item_description || null,
        imageUrl:        raw.image_url || null,
        productUrl:      raw.product_url || null,
        dataGrade:       null,
        bottleCollection,

        // ── Fitment ────────────────────────────────────────────────
        fitmentStatus:   null,
        components:      Array.isArray(raw.compatible_components) ? raw.compatible_components : null,
        graceDescription: null,

        // ── Meta ───────────────────────────────────────────────────
        verified:        false,
        importSource:    "grace_products_final_json",
    };
}

// ─── Products ────────────────────────────────────────────────────────────────
async function seedProducts() {
    const filePath = path.join(ROOT, "data", "grace_products_final.json");
    if (!fs.existsSync(filePath)) {
        console.error("❌ grace_products_final.json not found in data/");
        process.exit(1);
    }

    const rawProducts = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Normalize snake_case JSON → camelCase schema format, skip invalid records
    const products = [];
    let skipped = 0;
    for (const raw of rawProducts) {
        const p = normalizeProduct(raw);
        if (!p.graceSku || !p.websiteSku || !p.itemName) {
            skipped++;
            continue; // skip records missing required identifiers
        }
        products.push(p);
    }

    console.log(`📦 Normalized ${products.length} products from grace_products_final.json${skipped > 0 ? ` (skipped ${skipped} with missing required fields)` : ""}`);

    if (clearFirst) {
        console.log("🗑️  Clearing existing products...");
        console.log("⚠️  Note: Clear must be done from Convex dashboard. Proceeding with insert.");
    }

    const totalBatches = Math.ceil(products.length / BATCH_SIZE);
    console.log(`🚀 Seeding ${products.length} products in ${totalBatches} batches of ${BATCH_SIZE}...\n`);

    let totalInserted = 0;
    for (let i = 0; i < totalBatches; i++) {
        const batch = products.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        try {
            const result = await client.action(api.seedProducts.seedBatch, {
                products: batch,
                batchIndex: i,
            });
            totalInserted += result.inserted;
            const pct = Math.round(((i + 1) / totalBatches) * 100);
            process.stdout.write(`\r  ✅ Batch ${i + 1}/${totalBatches} — ${totalInserted} products seeded (${pct}%)`);
        } catch (err) {
            console.error(`\n❌ Failed on batch ${i + 1}:`, err.message || err);
            console.error(`   First SKU in failed batch: ${batch[0]?.graceSku}`);
            // Continue with remaining batches
        }
    }
    console.log(`\n\n🎉 Product seeding complete! ${totalInserted} products loaded.\n`);
}

// ─── Fitments ────────────────────────────────────────────────────────────────
async function seedFitments() {
    const filePath = path.join(ROOT, "data", "grace_fitment.json");
    if (!fs.existsSync(filePath)) {
        console.error("❌ grace_fitment.json not found in data/");
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const fitments = raw.fitmentRules || raw;
    console.log(`🔧 Loaded ${fitments.length} fitment rules from grace_fitment.json`);

    const totalBatches = Math.ceil(fitments.length / BATCH_SIZE);
    console.log(`🚀 Seeding ${fitments.length} fitments in ${totalBatches} batches...\n`);

    let totalInserted = 0;
    for (let i = 0; i < totalBatches; i++) {
        const batch = fitments.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        try {
            const result = await client.action(api.seedProducts.seedFitmentBatch, {
                fitments: batch,
                batchIndex: i,
            });
            totalInserted += result.inserted;
            const pct = Math.round(((i + 1) / totalBatches) * 100);
            process.stdout.write(`\r  ✅ Batch ${i + 1}/${totalBatches} — ${totalInserted} fitments seeded (${pct}%)`);
        } catch (err) {
            console.error(`\n❌ Failed on batch ${i + 1}:`, err.message || err);
        }
    }
    console.log(`\n\n🎉 Fitment seeding complete! ${totalInserted} rules loaded.\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  Best Bottles — Convex Database Seeder              ║");
    console.log("║  Source: grace_products_final.json (2,285 pure SKUs)║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    if (!fitmentsOnly) await seedProducts();
    if (!productsOnly) await seedFitments();

    console.log("✨ All done! Your Convex database is loaded and ready.");
}

main().catch(console.error);
