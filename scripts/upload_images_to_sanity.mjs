// upload_images_to_sanity.mjs
// Universal script — uploads grid images to Sanity and writes heroImageUrl to Convex.
// Works for any product family (Diva, Elegant, Empire, Grace, Round, Slim, Sleek, etc.)
//
// Usage:
//   node scripts/upload_images_to_sanity.mjs                   # all families
//   node scripts/upload_images_to_sanity.mjs --family Diva     # one family
//   node scripts/upload_images_to_sanity.mjs --dry-run         # preview only
//
// Naming convention for SKU subfolders (must live at GRID_ROOT/{family?}/{SKU}/):
//   The SKU folder name drives applicator detection. Pattern examples:
//     GBDiva30LpBlk  → Diva 30ml Lotion Pump / Black hardware
//     GBElg60AnSpBlk → Elegant 60ml Antique Bulb Spray / Black hardware
//     GBEmp50SpryBlk → Empire 50ml Fine Mist Spray / Black hardware
//   Applicator codes (case-sensitive, checked in order — most specific first):
//     AnSpTsl / TslBlk  → antiquespray-tassel
//     AnSp / ASp         → antiquespray
//     Spry               → finemist
//     Lp / Pmp           → lotionpump
//     Rdc / Red          → reducer
//     Drp / Drop         → dropper
//     Rol / Rolln        → rollon
//     Cap / Closure      → capclosure

import { createClient as createSanityClient } from "@sanity/client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });

// ── CONFIG ────────────────────────────────────────────────────────────────────
// Root of the pipeline output — may contain family subfolders OR direct SKU folders
const GRID_ROOT = "/Users/jordanrichter/Projects/Clients/Best Bottles/bottle-image-pipeline/output_collections/grid";

const ARG_FAMILY = (() => {
    const i = process.argv.indexOf("--family");
    return i !== -1 ? process.argv[i + 1] : null;
})();
const DRY_RUN = process.argv.includes("--dry-run");

// Styled background keywords → skip these for grid (plain bg only)
const STYLED_BG_KEYWORDS = [
    "silk_misty", "olive_wood", "rose_quartz", "stone", "botanical",
    "sandstone", "travertine", "slate", "linen", "marble",
    "_v1_", "_v2_", "_v3_",
];

// ── APPLICATOR MATCHING ───────────────────────────────────────────────────────
// Order matters: most-specific patterns first
const SKU_TO_APPLICATOR = [
    { patterns: ["AnSpTsl", "TslBlk"], bucket: "antiquespray-tassel" },
    { patterns: ["AnSp", "ASp"], bucket: "antiquespray" },
    { patterns: ["Spry", "SpryCu"], bucket: "finemist" },
    { patterns: ["Lp", "Pmp"], bucket: "lotionpump" },
    { patterns: ["Rdc", "Red"], bucket: "reducer" },
    { patterns: ["Drp", "Drop"], bucket: "dropper" },
    { patterns: ["Rol", "Rolln", "Rbl"], bucket: "rollon" },
    { patterns: ["Cap", "Closure"], bucket: "capclosure" },
];

function skuToBucket(sku) {
    for (const { patterns, bucket } of SKU_TO_APPLICATOR) {
        if (patterns.some((p) => sku.includes(p))) return bucket;
    }
    return null;
}

function groupMatchesSku(group, sku) {
    const slug = group.slug ?? "";
    const bucket = skuToBucket(sku);

    const capMl = group.capacityMl ? String(Math.round(group.capacityMl)) : null;
    if (!capMl || !sku.toLowerCase().includes(capMl.toLowerCase())) return false;

    if (!bucket || !slug.endsWith(bucket)) return false;

    const isFrosted = /Frst/i.test(sku);
    if (isFrosted !== slug.includes("frosted")) return false;

    return true;
}

// ── PLAIN-BG IMAGE SELECTION ──────────────────────────────────────────────────
function isPlainBackground(filename) {
    return !STYLED_BG_KEYWORDS.some((kw) => filename.toLowerCase().includes(kw));
}

function extractTimestamp(filename) {
    const m = filename.match(/(\d{8}[_-]\d{6})/);
    return m ? m[1] : "00000000_000000";
}

function pickBestImage(dir) {
    let files;
    try { files = fs.readdirSync(dir); } catch { return null; }
    const candidates = files
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f) && isPlainBackground(f))
        .sort((a, b) => extractTimestamp(b).localeCompare(extractTimestamp(a)));
    return candidates.length > 0 ? path.join(dir, candidates[0]) : null;
}

// ── DISCOVER SKU FOLDERS ──────────────────────────────────────────────────────
// Accepts either:  GRID_ROOT/GBDiva30LpBlk/   (flat)
//              or: GRID_ROOT/Diva/GBDiva30LpBlk/  (family subfolder)
function discoverSkuFolders(familyFilter) {
    const results = [];

    const topEntries = fs.readdirSync(GRID_ROOT, { withFileTypes: true });

    for (const entry of topEntries) {
        if (!entry.isDirectory()) continue;
        const topName = entry.name;
        const topPath = path.join(GRID_ROOT, topName);

        // Flat SKU folder (starts with GB or PB directly)
        if (/^(GB|PB)/i.test(topName)) {
            const family = detectFamily(topName);
            if (!familyFilter || family?.toLowerCase() === familyFilter.toLowerCase()) {
                results.push({ sku: topName, dir: topPath, family: family ?? "Unknown" });
            }
            continue;
        }

        // Named family subfolder (e.g. "Diva", "Elegant")
        if (familyFilter && topName.toLowerCase() !== familyFilter.toLowerCase()) continue;

        const subEntries = fs.readdirSync(topPath, { withFileTypes: true });
        for (const sub of subEntries) {
            if (!sub.isDirectory()) continue;
            const subName = sub.name;
            if (!/^(GB|PB)/i.test(subName)) continue;
            const family = detectFamily(subName) ?? topName;
            results.push({ sku: subName, dir: path.join(topPath, subName), family });
        }
    }

    return results;
}

// Detect the product family name from a SKU prefix
const FAMILY_SKU_MAP = [
    { prefix: "GBDivaFrst", family: "Diva" },
    { prefix: "GBDiva", family: "Diva" },
    { prefix: "GBElgFrst", family: "Elegant" },
    { prefix: "GBElg", family: "Elegant" },
    { prefix: "GBEmp", family: "Empire" },
    { prefix: "GBGrce", family: "Grace" },
    { prefix: "GBRndFrst", family: "Round" },
    { prefix: "GBRnd", family: "Round" },
    { prefix: "GBSlk", family: "Sleek" },
    { prefix: "GBSlm", family: "Slim" },
    { prefix: "GBcyl", family: "Cylinder" },
    { prefix: "GBCyl", family: "Cylinder" },
    { prefix: "GBAtom", family: "Atomizer" },
    { prefix: "GBBstn", family: "Boston Round" },
    { prefix: "GBBell", family: "Bell" },
    { prefix: "GBSpry", family: "Spray" },
    { prefix: "PB", family: "Plastic Bottle" },
];

function detectFamily(sku) {
    for (const { prefix, family } of FAMILY_SKU_MAP) {
        if (sku.startsWith(prefix)) return family;
    }
    return null;
}

// ── CLIENTS ───────────────────────────────────────────────────────────────────
const sanity = createSanityClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "gh97irjh",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    token: process.env.SANITY_API_TOKEN,
    apiVersion: "2024-01-01",
    useCdn: false,
});

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log("\n🍾  Best Bottles — Universal Grid Image Upload");
    console.log(`📂  Root      : ${GRID_ROOT}`);
    console.log(`🏷️   Family    : ${ARG_FAMILY ?? "ALL"}`);
    console.log(`🔍  Mode      : ${DRY_RUN ? "DRY RUN" : "LIVE UPLOAD"}\n`);

    if (!process.env.SANITY_API_TOKEN) {
        console.error("❌  SANITY_API_TOKEN not set in .env.local"); process.exit(1);
    }

    // ── Discover folders ────────────────────────────────────────────────────
    const skuFolders = discoverSkuFolders(ARG_FAMILY ?? null);
    console.log(`📋  Found ${skuFolders.length} SKU folder(s)\n`);

    // ── Applicator breakdown ────────────────────────────────────────────────
    const byBucket = {};
    for (const { sku } of skuFolders) {
        const b = skuToBucket(sku) ?? "unknown";
        (byBucket[b] = byBucket[b] ?? []).push(sku);
    }
    console.log("📊  Applicator breakdown:");
    for (const [b, skus] of Object.entries(byBucket)) {
        console.log(`    ${b.padEnd(22)} (${skus.length})`);
    }
    console.log();

    // ── Upload to Sanity ────────────────────────────────────────────────────
    const results = [];
    let uploaded = 0, skipped = 0;

    for (const { sku, dir, family } of skuFolders) {
        const imgPath = pickBestImage(dir);
        const bucket = skuToBucket(sku);

        if (!imgPath) {
            console.log(`⏭️   ${sku.padEnd(32)} no plain-bg image`);
            skipped++;
            continue;
        }

        const filename = path.basename(imgPath);
        console.log(`📸  ${sku.padEnd(32)} [${(bucket ?? "?").padEnd(22)}] ↳ ${filename}`);

        if (DRY_RUN) {
            results.push({ sku, family, bucket, imgPath, sanityUrl: null });
            uploaded++;
            continue;
        }

        try {
            const asset = await sanity.assets.upload("image", fs.readFileSync(imgPath), {
                filename: `${sku}_grid.png`,
                contentType: "image/png",
            });
            console.log(`    ✅ ${asset.url}`);
            results.push({ sku, family, bucket, imgPath, sanityUrl: asset.url, assetId: asset._id });
            uploaded++;
            await new Promise((r) => setTimeout(r, 250));
        } catch (err) {
            console.error(`    ❌ Upload failed: ${err.message}`);
            skipped++;
        }
    }

    console.log("\n" + "─".repeat(70));
    console.log(`✅  Uploaded: ${uploaded}   ⏭️  Skipped: ${skipped}\n`);

    if (DRY_RUN) {
        console.log("ℹ️   DRY RUN — no changes written.\n"); return;
    }

    // ── Write manifest ──────────────────────────────────────────────────────
    const stamp = new Date().toISOString().slice(0, 10);
    const manifestPath = path.join(__dirname, `../data/sanity_upload_manifest_${stamp}.json`);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));
    console.log(`📄  Manifest → ${path.relative(process.cwd(), manifestPath)}\n`);

    // ── Update Convex ───────────────────────────────────────────────────────
    console.log("📡  Updating Convex productGroups...\n");

    // Group uploaded images by Convex family name
    const familiesInBatch = [...new Set(results.map((r) => r.family))];
    let totalUpdated = 0;
    const unmatched = [];

    for (const family of familiesInBatch) {
        const familyResults = results.filter((r) => r.family === family && r.sanityUrl);
        if (familyResults.length === 0) continue;

        const groups = await convex.query(api.products.getProductGroupsByFamily, { family });
        console.log(`  ${family.padEnd(16)} ${groups?.length ?? 0} groups, ${familyResults.length} images`);

        for (const group of groups ?? []) {
            const match = familyResults.find((r) => groupMatchesSku(group, r.sku));
            if (match) {
                try {
                    await convex.mutation(api.products.updateProductGroupHeroImage, {
                        id: group._id,
                        heroImageUrl: match.sanityUrl,
                    });
                    console.log(`    ✅ ${group.slug} ← ${match.sku}`);
                    totalUpdated++;
                } catch (err) {
                    console.error(`    ❌ ${group.slug}: ${err.message}`);
                }
            } else {
                unmatched.push({ slug: group.slug, family });
            }
        }
    }

    // ── Gap report ──────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(70)}`);
    console.log(`🎉  Updated ${totalUpdated} product groups in Convex.\n`);

    if (unmatched.length > 0) {
        const byFamily = {};
        for (const { slug, family } of unmatched) {
            (byFamily[family] = byFamily[family] ?? []).push(slug);
        }
        console.log(`⚠️   ${unmatched.length} group(s) still need images:`);
        for (const [fam, slugs] of Object.entries(byFamily)) {
            console.log(`\n  ${fam}:`);
            for (const s of slugs) console.log(`    ❌ ${s}`);
        }
        console.log();
    }
}

main().catch((err) => { console.error("❌ Fatal:", err); process.exit(1); });
