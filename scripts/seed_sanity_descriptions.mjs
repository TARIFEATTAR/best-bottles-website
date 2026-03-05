#!/usr/bin/env node
/**
 * Seed productGroupContent documents in Sanity with pdpRichDescription blocks.
 * Uses descriptions from data/all_product_descriptions.json.
 * Each Convex product group gets one productGroupContent doc (slug = group slug).
 *
 * Usage:
 *   node scripts/seed_sanity_descriptions.mjs --dry-run   # preview
 *   node scripts/seed_sanity_descriptions.mjs             # create documents
 */
import { createClient } from "@sanity/client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_STUDIO_DATASET || "production";
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!projectId || !convexUrl) {
    console.error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_CONVEX_URL");
    process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");

const sanity = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    useCdn: false,
    token: process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_TOKEN,
});

if (!(process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_TOKEN) && !isDryRun) {
    console.error("SANITY_API_WRITE_TOKEN or SANITY_API_TOKEN required for writes. Set in .env.local or use --dry-run.");
    process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);
const groups = await convex.query(api.products.getAllCatalogGroups, {});

const descPath = resolve(ROOT, "data", "all_product_descriptions.json");
const descJson = JSON.parse(readFileSync(descPath, "utf-8"));

// Build map: (family, capacityMl) -> description
const descMap = new Map();
for (const [family, arr] of Object.entries(descJson)) {
    if (family.startsWith("_")) continue;
    for (const d of arr) {
        descMap.set(`${family}|${d.capacityMl}`, d.description);
    }
}

// Portable Text: single block with one span
function textToPortableText(text) {
    return [
        {
            _type: "block",
            _key: "desc-" + Math.random().toString(36).slice(2, 11),
            style: "normal",
            markDefs: [],
            children: [
                {
                    _type: "span",
                    _key: "span-" + Math.random().toString(36).slice(2, 11),
                    text,
                    marks: [],
                },
            ],
        },
    ];
}

let created = 0;
let skipped = 0;

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║  Best Bottles — Seed Sanity Product Descriptions    ║");
console.log("╚══════════════════════════════════════════════════════╝\n");
console.log(`  Groups: ${groups.length}`);
console.log(`  Dry run: ${isDryRun}`);

for (const g of groups) {
    const family = g.family || "Unknown";
    const capMl = g.capacityMl ?? 0;
    const desc = descMap.get(`${family}|${capMl}`);
    if (!desc) {
        skipped++;
        continue;
    }

    const slug = g.slug;
    const displayName = g.displayName || slug;

    const doc = {
        _type: "productGroupContent",
        slug: { _type: "slug", current: slug },
        title: displayName,
        overrideTemplate: false,
        pageBlocks: [
            {
                _type: "pdpRichDescription",
                _key: "desc-" + slug.replace(/[^a-z0-9]/gi, "-").slice(0, 20),
                eyebrow: "About This Product",
                heading: displayName,
                body: textToPortableText(desc),
            },
        ],
    };

    if (isDryRun) {
        if (created < 3) console.log(`  Would create: ${slug}`);
        created++;
        continue;
    }

    try {
        await sanity.createOrReplace({
            ...doc,
            _id: "productGroupContent-" + slug.replace(/[^a-z0-9-]/gi, "-"),
        });
        created++;
        if (created % 50 === 0) process.stdout.write(`  ${created} created\r`);
    } catch (err) {
        console.error(`  ❌ ${slug}: ${err.message}`);
    }
}

console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║  Done                                               ║");
console.log("╚══════════════════════════════════════════════════════╝");
console.log(`\n  ✅ Created/updated: ${created}`);
console.log(`  ⏭️  Skipped (no description): ${skipped}\n`);
