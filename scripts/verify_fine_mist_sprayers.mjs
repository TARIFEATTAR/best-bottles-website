#!/usr/bin/env node
/**
 * Verify that all products from the Best Bottles "Glass Bottles with Fine Mist Sprayers"
 * page are in Convex. Uses getCompatibleFitments which looks up by websiteSku or graceSku.
 *
 * To add missing products first, run:
 *   node scripts/run_add_missing_sprayers.mjs
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

// All products from https://www.bestbottles.com/all-bottles/Perfume-atomizer-aluminum-bottle-cans/bestbottles-glass-bottles-with-fine-mist-sprayers.php
const FINE_MIST_SPRAYER_SKUS = [
    "GBSpry3mlClBlk",
    "GBSpry4mlClBlk",
    "GBCyl5SpryBlkMatt",
    "GBCylBlu5SpryBlkSh",
    "GBSleek5SpryBlkMatt",
    "GBTulipAmb5SpryBlkMatt",
    "GBTulip6SpryBlkSh",
    "GBSleek8SpryBlkMatt",
    "GBCyl9SpryBlk",
    "GBCylAmb9SpryBlk",
    "GBCylBlu9SpryBlk",
    "GBCylFrst9SpryBlk",
    "GBCylSwrl9SpryBlk",
    "GBPillar9SpryBlkMatt",
    "GBTallCyl9SpryBlkMatt",
    "GBTallCylFrst9SpryBlkMatt",
    "GBBell10SpryBlkSh",
    "GBRect10SpryBlkMatt",
    "GBTallRect10SpryBlkMatt",
    "GBRoyal13SpryBlkSh",
    "GBCrcl15SpryBlkMatt",
    "GBElg15SpryBlkMatt",
    "GBElgFrst15SpryBlkMatt",
    "GBFlair15SpryBlkMatt",
    "GBSqr15SpryBlkSh",
];

async function main() {
    console.log("Verifying Fine Mist Sprayer products in Convex...\n");

    const found = [];
    const missing = [];

    for (const sku of FINE_MIST_SPRAYER_SKUS) {
        const result = await client.query(api.products.getCompatibleFitments, { bottleSku: sku });
        if (result?.bottle) {
            found.push({ sku, graceSku: result.bottle.graceSku, family: result.bottle.family });
        } else {
            missing.push(sku);
        }
    }

    console.log("✅ IN CONVEX:", found.length);
    found.forEach(({ sku, graceSku, family }) => {
        console.log(`   ${sku} → ${graceSku} (${family})`);
    });

    if (missing.length > 0) {
        console.log("\n❌ MISSING FROM CONVEX:", missing.length);
        missing.forEach((sku) => console.log(`   ${sku}`));
        console.log("\nThese products are on bestbottles.com but not in grace_products_final.json.");
        process.exit(1);
    }

    console.log("\n✨ All 25 Fine Mist Sprayer products (including Tulip) are in Convex.");
}

main().catch(console.error);
