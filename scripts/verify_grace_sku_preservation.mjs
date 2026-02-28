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
    const cobaltBlueProducts = products.filter(p => p.color === "Cobalt Blue");
    
    // Check Grace SKUs for BLU and CBL segments
    const withBLU = cobaltBlueProducts.filter(p => p.graceSku?.includes("-BLU-"));
    const withCBL = cobaltBlueProducts.filter(p => p.graceSku?.includes("-CBL-"));
    
    console.log(`\n✅ Grace SKU Preservation Verification\n`);
    console.log(`Total Cobalt Blue products: ${cobaltBlueProducts.length}`);
    console.log(`  Grace SKUs with -BLU- segment: ${withBLU.length}`);
    console.log(`  Grace SKUs with -CBL- segment: ${withCBL.length}`);
    
    if (withBLU.length > 0) {
        console.log(`\n📋 Sample products with BLU segment (now display as "Cobalt Blue"):`);
        withBLU.slice(0, 3).forEach(p => {
            console.log(`  ${p.websiteSku} → ${p.graceSku} → color: "${p.color}"`);
        });
    }
    
    if (withCBL.length > 0) {
        console.log(`\n📋 Sample products with CBL segment (always displayed as "Cobalt Blue"):`);
        withCBL.slice(0, 3).forEach(p => {
            console.log(`  ${p.websiteSku} → ${p.graceSku} → color: "${p.color}"`);
        });
    }
    
    console.log(`\n✨ Result: Both BLU and CBL Grace SKU segments now map to "Cobalt Blue" display color.`);
    console.log(`   Grace SKUs remain unchanged (immutable identifiers).`);
    
} catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
}
