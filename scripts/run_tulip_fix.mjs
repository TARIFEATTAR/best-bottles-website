#!/usr/bin/env node
/**
 * Tulip Reclassification + Re-grouping
 *
 * Fixes Cylinder/Tulip mixing: Tulip bottles were incorrectly classified as
 * family "Cylinder", causing them to appear on Cylinder PDPs.
 *
 * Steps:
 *   1. fixTulipFamily     — reclassify GBTulip* products to family "Tulip"
 *   2. buildProductGroups — rebuild groups (Tulip now gets own groups)
 *   3. linkProductsToGroups — relink all products to their groups
 *
 * Usage:
 *   node scripts/run_tulip_fix.mjs
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
    console.log("║  Best Bottles — Tulip Reclassification + Re-grouping  ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    // ─── Step 1: Fix Tulip family ───────────────────────────────────────────
    console.log("Step 1/3 — Reclassifying Tulip products...");
    try {
        const result = await client.action(api.migrations.fixTulipFamily, {});
        console.log(`  ✅ ${result.message}`);
        if (result.totalFixed > 0 && result.details?.length <= 10) {
            result.details.forEach((d) => console.log(`     ${d}`));
        } else if (result.totalFixed > 10) {
            console.log(`     (${result.totalFixed} products reclassified)`);
        }
        console.log();
    } catch (err) {
        console.error("  ❌ fixTulipFamily failed:", err.message || err);
        process.exit(1);
    }

    // ─── Step 2: Build product groups ────────────────────────────────────────
    console.log("Step 2/3 — Rebuilding product groups...");
    try {
        const result = await client.action(api.migrations.buildProductGroups, {});
        console.log(`  ✅ ${result.message}\n`);
    } catch (err) {
        console.error("  ❌ buildProductGroups failed:", err.message || err);
        process.exit(1);
    }

    // ─── Step 3: Link products to groups ──────────────────────────────────────
    console.log("Step 3/3 — Linking products to groups...");
    try {
        const result = await client.action(api.migrations.linkProductsToGroups, {});
        console.log(`  ✅ ${result.message}\n`);
    } catch (err) {
        console.error("  ❌ linkProductsToGroups failed:", err.message || err);
        process.exit(1);
    }

    // ─── Verify ─────────────────────────────────────────────────────────────
    console.log("Verifying migration status...");
    try {
        const status = await client.action(api.migrations.checkMigrationStatus, {});
        console.log("  Product groups:", status.productGroups);
        console.log("  Total products:", status.totalProducts);
        console.log("  Products linked:", status.productsLinked);
        if (status.productsUnlinked > 0) {
            console.log("  Products unlinked:", status.productsUnlinked);
        }
        console.log("\n✨ Done! Cylinder and Tulip are now in separate groups.");
    } catch (err) {
        console.error("  ⚠️ checkMigrationStatus failed:", err.message || err);
    }
}

main().catch(console.error);
