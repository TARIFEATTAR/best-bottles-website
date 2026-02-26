#!/usr/bin/env node
/**
 * Runs the BSR dropper/cap fix migration.
 *
 * Removes mismatched tube-length dropper components from Boston Round products:
 *   15ml BSR → removes 90mm dropper (wrong for ~68mm bottle)
 *   30ml BSR → removes 90mm droppers + 2oz cap (those belong on 60ml)
 *   60ml BSR → removes 76mm droppers + 1oz cap (those belong on 30ml)
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

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) { console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local"); process.exit(1); }

const client = new ConvexHttpClient(url);

async function main() {
    console.log("Running BSR dropper/cap fix...\n");

    const result = await client.action(api.migrations.fixBsrDroppers, {});
    console.log("Result:", result);

    console.log("\nVerifying status...");
    const status = await client.action(api.migrations.checkMigrationStatus, {});
    console.log("Status:", status);
}

main().catch((err) => { console.error(err); process.exit(1); });
