#!/usr/bin/env node
/**
 * Add missing Fine Mist Sprayer products + re-group
 *
 * Adds: GBCylSwrl9SpryBlk, GBPillar9SpryBlkMatt, GBBell10SpryBlkSh
 * Then rebuilds product groups and links.
 *
 * Usage: node scripts/run_add_missing_sprayers.mjs
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").replace(/#.*$/, "").trim();
        if (key && value) process.env[key.trim()] = value;
    }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL not set");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  Add Missing Fine Mist Sprayer Products + Re-group   ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    console.log("Step 1/3 — Adding missing products...");
    const addResult = await client.action(api.migrations.addMissingFineMistSprayers, {});
    console.log(`  ✅ ${addResult.message}`);
    if (addResult.added?.length) {
        addResult.added.forEach((s) => console.log(`     + ${s}`));
    }
    console.log();

    console.log("Step 2/3 — Rebuilding product groups...");
    const buildResult = await client.action(api.migrations.buildProductGroups, {});
    console.log(`  ✅ ${buildResult.message}\n`);

    console.log("Step 3/3 — Linking products to groups...");
    const linkResult = await client.action(api.migrations.linkProductsToGroups, {});
    console.log(`  ✅ ${linkResult.message}\n`);

    const status = await client.action(api.migrations.checkMigrationStatus, {});
    console.log("Status: groups=" + status.productGroups + ", products=" + status.totalProducts + ", linked=" + status.productsLinked);
    console.log("\n✨ Done. Run node scripts/verify_fine_mist_sprayers.mjs to verify.");
}

main().catch(console.error);
