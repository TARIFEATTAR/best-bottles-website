#!/usr/bin/env node
/**
 * Phase 1.5: Field Enrichment Migration
 * Derives `applicator` and `color` from graceSku + itemName for all 2,285 products.
 * Then re-runs product grouping so groups split by glass color.
 *
 * Usage:
 *   node scripts/run_enrichment_migration.mjs
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

async function main() {
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  Best Bottles — Phase 1.5: Field Enrichment         ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    // ─── Step 1: Enrich applicator + color ───────────────────────────────────
    console.log("Step 1/3 — Deriving applicator + color from SKU codes...");
    try {
        const result = await client.action(api.migrations.enrichProductFields, {});
        console.log(`  ✅ ${result.message}\n`);
    } catch (err) {
        console.error("  ❌ enrichProductFields failed:", err.message || err);
        process.exit(1);
    }

    // ─── Step 2: Re-build product groups (now color-aware) ───────────────────
    console.log("Step 2/3 — Rebuilding product groups with color dimension...");
    try {
        const result = await client.action(api.migrations.buildProductGroups, {});
        console.log(`  ✅ ${result.message}\n`);
    } catch (err) {
        console.error("  ❌ buildProductGroups failed:", err.message || err);
        process.exit(1);
    }

    // ─── Step 3: Re-link all products to their new groups ────────────────────
    console.log("Step 3/3 — Re-linking products to color-aware groups...");
    try {
        const result = await client.action(api.migrations.linkProductsToGroups, {});
        console.log(`  ✅ ${result.message}\n`);
    } catch (err) {
        console.error("  ❌ linkProductsToGroups failed:", err.message || err);
        process.exit(1);
    }

    // ─── Verify ──────────────────────────────────────────────────────────────
    console.log("Verifying...");
    try {
        const status = await client.action(api.migrations.checkMigrationStatus, {});
        console.log("  Product groups:    ", status.productGroups);
        console.log("  Total products:    ", status.totalProducts);
        console.log("  Products linked:   ", status.productsLinked);
        console.log("  Products unlinked: ", status.productsUnlinked);

        if (status.isComplete) {
            console.log("\n✨ Enrichment complete! Products now have applicator + color data.");
            console.log("   Groups expanded from 93 → " + status.productGroups + " (color-aware).\n");
        } else {
            console.log("\n⚠️  Some products unlinked — check for unrecognized SKU patterns.");
        }
    } catch (err) {
        console.error("  ❌ checkMigrationStatus failed:", err.message || err);
    }
}

main().catch(console.error);
