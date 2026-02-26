#!/usr/bin/env node
/**
 * Option A: Populate applicatorTypes on productGroups
 * Run AFTER linkProductsToGroups. Required for applicator-first catalog filter.
 *
 * Usage:
 *   node scripts/run_populate_applicator_types.mjs
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
    console.log("Populating applicatorTypes on product groups (Option A)...\n");
    try {
        const result = await client.action(api.migrations.populateApplicatorTypes, {});
        console.log(`✅ ${result.message}\n`);
    } catch (err) {
        console.error("❌ populateApplicatorTypes failed:", err.message || err);
        process.exit(1);
    }
}

main().catch(console.error);
