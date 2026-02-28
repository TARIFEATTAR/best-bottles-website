#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
} catch {
    // .env.local optional
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

let cursor = undefined;
let hasMore = true;
let totalUpdated = 0;
let totalScanned = 0;
let batch = 1;

console.log("Fixing misparsed spray glass colors...\n");
while (hasMore) {
    const result = await client.mutation(api.migrations.fixMisparsedSprayGlassColors, {
        cursor,
        batchSize: 250,
    });
    totalUpdated += result.updated ?? 0;
    totalScanned += result.scanned ?? 0;
    hasMore = Boolean(result.hasMore);
    cursor = result.nextCursor ?? undefined;
    console.log(`Batch ${batch}: scanned ${result.scanned ?? 0}, updated ${result.updated ?? 0}`);
    batch++;
}

console.log(`\n✅ Done. Updated ${totalUpdated} products (scanned ${totalScanned}).`);
console.log("Next: run node scripts/run_grouping_migration.mjs");
