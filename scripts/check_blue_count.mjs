#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
const envPath = resolve(__dirname, "..", ".env.local");
try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.includes("#")) val = val.slice(0, val.indexOf("#")).trim();
        if (!process.env[key]) process.env[key] = val;
    }
} catch { /* .env.local is optional */ }

import { api } from "../convex/_generated/api.js";
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

try {
    const products = await client.query(api.products.listAll, {});
    const blueCount = products.filter(p => p.color === "Blue").length;
    const cobaltCount = products.filter(p => p.color === "Cobalt Blue").length;
    
    console.log(`Current color distribution:`);
    console.log(`  Blue: ${blueCount}`);
    console.log(`  Cobalt Blue: ${cobaltCount}`);
    console.log(`  Total products: ${products.length}`);
} catch (err) {
    console.error("Query failed:", err);
    process.exit(1);
}
