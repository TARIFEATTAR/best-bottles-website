#!/usr/bin/env node
/**
 * Export product groups from Convex, grouped by family.
 * Used to generate descriptions for the Product Description Overhaul.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

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
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL");
    process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);
const groups = await client.query(api.products.getAllCatalogGroups, {});

// Group by family, then by capacityMl (unique)
const byFamily = {};
for (const g of groups) {
    const f = g.family || "Unknown";
    if (!byFamily[f]) byFamily[f] = [];
    byFamily[f].push({
        slug: g.slug,
        displayName: g.displayName,
        capacityMl: g.capacityMl,
        capacity: g.capacity,
        color: g.color,
        neckThreadSize: g.neckThreadSize,
        category: g.category,
    });
}

// Dedupe by (family, capacityMl, applicatorBucket) for applicator-specific description mapping
const BUCKETS = new Set(["rollon","finemist","perfumespray","antiquespray","antiquespray-tassel","dropper","lotionpump","reducer","glasswand","glassapplicator","capclosure"]);
function getApplicatorFromSlug(slug) {
    if (slug.endsWith("-antiquespray-tassel")) return "antiquespray-tassel";
    const last = slug.split("-").pop();
    return BUCKETS.has(last) ? last : null;
}
const uniqueByFamilyCap = {};
for (const [family, arr] of Object.entries(byFamily)) {
    const seen = new Set();
    const unique = [];
    for (const g of arr.sort((a, b) => (a.capacityMl ?? 0) - (b.capacityMl ?? 0))) {
        const bucket = getApplicatorFromSlug(g.slug);
        const key = `${family}|${g.capacityMl ?? 0}|${bucket ?? "generic"}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push({ ...g, applicatorBucket: bucket });
        }
    }
    uniqueByFamilyCap[family] = unique;
}

const outPath = resolve(ROOT, "data", "product_groups_by_family.json");
writeFileSync(outPath, JSON.stringify(uniqueByFamilyCap, null, 2), "utf-8");
console.log(`Exported ${groups.length} groups to ${outPath}`);
console.log("Families:", Object.keys(uniqueByFamilyCap).sort().join(", "));
