#!/usr/bin/env node
/**
 * Audit product descriptions against product groups.
 * Ensures every (family, capacityMl, applicatorBucket) has a matching description
 * (either applicator-specific or generic fallback).
 *
 * Run: node scripts/audit_descriptions.mjs
 * Optional: node scripts/export_product_groups.mjs first to refresh product_groups_by_family.json
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const GROUPS_PATH = resolve(ROOT, "data", "product_groups_by_family.json");
const DESCRIPTIONS_DIR = resolve(ROOT, "data", "descriptions");

const KNOWN_BUCKETS = new Set([
    "rollon", "finemist", "perfumespray", "antiquespray", "antiquespray-tassel",
    "dropper", "lotionpump", "reducer", "glasswand", "glassapplicator", "capclosure"
]);

function getApplicatorFromSlug(slug) {
    if (slug.endsWith("-antiquespray-tassel")) return "antiquespray-tassel";
    const last = slug.split("-").pop();
    return KNOWN_BUCKETS.has(last) ? last : null;
}

// Load product groups
const groupsByFamily = JSON.parse(readFileSync(GROUPS_PATH, "utf-8"));

// Load descriptions by family
const descFiles = readdirSync(DESCRIPTIONS_DIR).filter((f) => f.endsWith(".json"));
const descByFamily = {};
for (const f of descFiles) {
    const json = JSON.parse(readFileSync(resolve(DESCRIPTIONS_DIR, f), "utf-8"));
    descByFamily[json.family] = json.descriptions ?? [];
}

// Build lookup: for each family, what (capacityMl, applicatorBucket) combos have descriptions?
function buildDescLookup(descriptions) {
    const generic = new Map(); // capacityMl -> description
    const applicator = new Map(); // "capacityMl|bucket" -> description
    for (const d of descriptions) {
        if (d.applicatorBucket) {
            applicator.set(`${d.capacityMl}|${d.applicatorBucket}`, d.description);
        } else {
            generic.set(d.capacityMl, d.description);
        }
    }
    return { generic, applicator };
}

let totalGroups = 0;
let matchedApplicator = 0;
let matchedGeneric = 0;
let gaps = [];
let genericOnly = []; // groups with applicator that only got generic (could improve)

for (const [family, groups] of Object.entries(groupsByFamily)) {
    const descs = descByFamily[family] ?? [];
    const { generic, applicator } = buildDescLookup(descs);

    for (const g of groups) {
        const cap = g.capacityMl ?? 0;
        const bucket = g.applicatorBucket ?? getApplicatorFromSlug(g.slug ?? "");
        totalGroups++;

        const hasApplicatorDesc = bucket && applicator.has(`${cap}|${bucket}`);
        const hasGenericDesc = generic.has(cap);

        if (hasApplicatorDesc) {
            matchedApplicator++;
        } else if (hasGenericDesc) {
            matchedGeneric++;
            if (bucket) {
                genericOnly.push({ family, slug: g.slug, capacityMl: cap, applicatorBucket: bucket });
            }
        } else {
            gaps.push({
                family,
                slug: g.slug,
                capacityMl: cap,
                applicatorBucket: bucket,
                displayName: g.displayName,
            });
        }
    }
}

// Report
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  Product Description Audit                                  ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log(`  Product groups: ${totalGroups}`);
console.log(`  Matched (applicator-specific): ${matchedApplicator}`);
console.log(`  Matched (generic fallback): ${matchedGeneric}`);
console.log(`  Gaps (no description): ${gaps.length}\n`);

if (gaps.length > 0) {
    console.log("  ❌ GAPS — groups with no matching description:\n");
    const byFamily = {};
    for (const g of gaps) {
        if (!byFamily[g.family]) byFamily[g.family] = [];
        byFamily[g.family].push(g);
    }
    for (const [fam, arr] of Object.entries(byFamily).sort()) {
        console.log(`    ${fam}:`);
        for (const g of arr) {
            console.log(`      ${g.slug} (${g.capacityMl}ml, ${g.applicatorBucket ?? "generic"})`);
        }
        console.log("");
    }
}

if (genericOnly.length > 0) {
    console.log("  ℹ️  Generic-only — groups with applicator that use generic fallback (could add applicator-specific):\n");
    const byFamily = {};
    for (const g of genericOnly) {
        if (!byFamily[g.family]) byFamily[g.family] = [];
        byFamily[g.family].push(g);
    }
    const sample = Object.entries(byFamily).slice(0, 5);
    for (const [fam, arr] of sample) {
        const buckets = [...new Set(arr.map((a) => a.applicatorBucket))];
        console.log(`    ${fam}: ${arr.length} groups (${buckets.join(", ")})`);
    }
    if (genericOnly.length > 20) {
        console.log(`    ... and ${genericOnly.length - 20} more`);
    }
    console.log("");
}

// Families in product groups but not in descriptions
const missingFamilies = Object.keys(groupsByFamily).filter((f) => !descByFamily[f]?.length);
if (missingFamilies.length > 0) {
    console.log("  ⚠️  Families in product groups but no description file: " + missingFamilies.join(", "));
}

// Summary
const exitCode = gaps.length > 0 ? 1 : 0;
console.log(gaps.length === 0 ? "  ✅ All product groups have descriptions.\n" : "");

// Output JSON report for fixing generic-only (optional, for scripts)
if (process.argv.includes("--json")) {
    const report = {
        gaps,
        genericOnly: genericOnly.map((g) => ({
            family: g.family,
            capacityMl: g.capacityMl,
            applicatorBucket: g.applicatorBucket,
            slug: g.slug,
        })),
        genericOnlyByFamily: {},
    };
    for (const g of genericOnly) {
        const key = `${g.family}|${g.capacityMl}|${g.applicatorBucket}`;
        if (!report.genericOnlyByFamily[g.family]) report.genericOnlyByFamily[g.family] = [];
        const exists = report.genericOnlyByFamily[g.family].some(
            (x) => x.capacityMl === g.capacityMl && x.applicatorBucket === g.applicatorBucket
        );
        if (!exists) report.genericOnlyByFamily[g.family].push({ capacityMl: g.capacityMl, applicatorBucket: g.applicatorBucket });
    }
    console.log(JSON.stringify(report, null, 2));
}

process.exit(exitCode);
