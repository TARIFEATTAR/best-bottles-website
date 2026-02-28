#!/usr/bin/env node
/**
 * Phase 1: Product Grouping Migration
 * Groups 2,354 flat SKUs into ~230 parent productGroups in Convex.
 *
 * Steps:
 *   1. buildProductGroups  — creates ~230 productGroup documents
 *   2. linkProductsToGroups — sets productGroupId on all 2,354 products
 *   3. populateApplicatorTypes — fills applicatorTypes for catalog filter
 *   4. checkMigrationStatus — verifies everything linked correctly
 *
 * Usage:
 *   node scripts/run_grouping_migration.mjs
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
    console.log("║  Best Bottles — Phase 1: Product Grouping Migration  ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    // ─── Step 1: Build product groups ────────────────────────────────────────
    console.log("Step 1/4 — Building product group documents...");
    try {
        const result = await client.action(api.migrations.buildProductGroups, {});
        console.log(`  ✅ ${result.message}\n`);
    } catch (err) {
        console.error("  ❌ buildProductGroups failed:", err.message || err);
        process.exit(1);
    }

    // ─── Step 2: Link products to their groups ────────────────────────────────
    console.log("Step 2/4 — Linking all products to their groups...");
    try {
        const result = await client.action(api.migrations.linkProductsToGroups, {});
        console.log(`  ✅ ${result.message}\n`);
    } catch (err) {
        console.error("  ❌ linkProductsToGroups failed:", err.message || err);
        process.exit(1);
    }

    // ─── Step 3: Populate applicator types (for catalog filter) ────────────────
    console.log("Step 3/4 — Populating applicator types on product groups...");
    try {
        const applResult = await client.action(api.migrations.populateApplicatorTypes, {});
        console.log(`  ✅ ${applResult.message}\n`);
    } catch (err) {
        console.error("  ❌ populateApplicatorTypes failed:", err.message || err);
        process.exit(1);
    }

    // ─── Step 4: Verify ───────────────────────────────────────────────────────
    console.log("Step 4/4 — Verifying migration status...");
    try {
        const status = await client.action(api.migrations.checkMigrationStatus, {});
        console.log("  Product groups created:", status.productGroups);
        console.log("  Total products:        ", status.totalProducts);
        console.log("  Products linked:       ", status.productsLinked);
        console.log("  Products unlinked:     ", status.productsUnlinked);

        if (status.isComplete) {
            console.log("\n✨ Migration complete! The catalog is now grouped.\n");
            console.log("   Next: open /catalog in your browser to verify grouped cards.");
        } else {
            console.log("\n⚠️  Migration incomplete — some products may not be linked.");
            console.log("   Check for products with null family or color values.");
        }
    } catch (err) {
        console.error("  ❌ checkMigrationStatus failed:", err.message || err);
    }
}

main().catch(console.error);
