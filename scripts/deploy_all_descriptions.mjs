#!/usr/bin/env node
/**
 * Deploy all product descriptions to Convex (groupDescription for Grace search + JSON-LD).
 *
 * Reads all JSON files from data/descriptions/ and calls migrations.patchFamilyDescriptions
 * for each family.
 *
 * Usage:
 *   node scripts/deploy_all_descriptions.mjs             # live push
 *   node scripts/deploy_all_descriptions.mjs --dry-run   # preview, no writes
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DESCRIPTIONS_DIR = resolve(ROOT, "data", "descriptions");

function loadEnvLocal() {
    const envPath = resolve(ROOT, ".env.local");
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
    } catch {}
}

loadEnvLocal();
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL");
    process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");
const files = readdirSync(DESCRIPTIONS_DIR).filter((f) => f.endsWith(".json"));
const families = files.map((f) => {
    const json = JSON.parse(readFileSync(resolve(DESCRIPTIONS_DIR, f), "utf-8"));
    return { file: f, name: json.family, descriptions: json.descriptions };
});

const total = families.reduce((s, f) => s + (f.descriptions?.length ?? 0), 0);

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║  Best Bottles — Deploy Product Descriptions         ║");
console.log("╚══════════════════════════════════════════════════════╝\n");
console.log(`  Source:  ${DESCRIPTIONS_DIR}`);
console.log(`  Families: ${families.length}`);
console.log(`  Total descriptions: ${total}`);

if (isDryRun) {
    console.log("\n  ⚠️  DRY RUN — no writes will be made.\n");
    for (const f of families.slice(0, 3)) {
        const descs = f.descriptions ?? [];
        console.log(`  [${f.name}] ${descs.length} capacity(ies)`);
        for (const d of descs.slice(0, 2)) {
            console.log(`    ${d.capacityMl}ml: ${d.description.slice(0, 80)}…`);
        }
    }
    console.log("\n  Run without --dry-run to push to Convex.\n");
    process.exit(0);
}

const client = new ConvexHttpClient(convexUrl);
let totalPatched = 0;

for (const { name: family, descriptions } of families) {
    if (!Array.isArray(descriptions) || descriptions.length === 0) continue;
    try {
        const result = await client.mutation(api.migrations.patchFamilyDescriptions, {
            family,
            descriptions,
        });
        totalPatched += result.patched;
        console.log(`  ${family}: ${result.patched}/${result.total} groups patched`);
    } catch (err) {
        console.error(`  ❌ ${family}: ${err.message || err}`);
    }
}

console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║  Done                                               ║");
console.log("╚══════════════════════════════════════════════════════╝");
console.log(`\n  ✅ Total groups patched: ${totalPatched}\n`);
