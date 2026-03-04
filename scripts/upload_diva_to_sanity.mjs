// upload_diva_to_sanity.mjs
// Uploads Diva grid images to Sanity and writes CDN URLs to Convex.
//
// MATCHING LOGIC (strict — image must match the group's applicator type):
//   SKU suffix -> applicator bucket in slug
//   AnSp / Spry / ASp  -> "-spray"
//   Lp / Pmp           -> "-lotionpump"
//   Rdc / Red          -> "-reducer"
//   Drp / Drop         -> "-dropper"
//   Cap                -> "-capclosure"
//
// Usage:
//   node scripts/upload_diva_to_sanity.mjs --dry-run   (preview only)
//   node scripts/upload_diva_to_sanity.mjs             (upload + update Convex)
//   node scripts/upload_diva_to_sanity.mjs --clear-wrong  (remove bad assignments first)

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

const GRID_DIR = "/Users/jordanrichter/Projects/Clients/Best Bottles/bottle-image-pipeline/output_collections/grid/Diva";
const FAMILY_FILTER = "Diva";
const DRY_RUN = process.argv.includes("--dry-run");
const CLEAR_WRONG = process.argv.includes("--clear-wrong");

// Keywords in filename that indicate a STYLED background (skip for grid)
const STYLED_BG_KEYWORDS = [
    "silk_misty", "olive_wood", "rose_quartz", "stone", "botanical",
    "sandstone", "travertine", "slate", "linen", "marble",
    "_v1_", "_v2_", "_v3_",
];

// ── APPLICATOR MATCHING ───────────────────────────────────────────────────────
// Maps SKU name patterns -> slug applicator suffix (must match migrations.ts APPLICATOR_BUCKET_MAP)
// Order matters: tassel variants MUST be checked before plain AnSp
const SKU_TO_APPLICATOR_SLUG = [
    { patterns: ["AnSpTsl", "TslBlk"], slugSuffix: "antiquespray-tassel" }, // antique bulb + tassel
    { patterns: ["AnSp", "ASp"], slugSuffix: "antiquespray" },         // antique bulb (no tassel)
    { patterns: ["Spry", "SpryCu"], slugSuffix: "finemist" },              // fine mist sprayer
    { patterns: ["Lp", "Pmp"], slugSuffix: "lotionpump" },
    { patterns: ["Rdc", "Red"], slugSuffix: "reducer" },
    { patterns: ["Drp", "Drop"], slugSuffix: "dropper" },
    { patterns: ["Cap", "Closure"], slugSuffix: "capclosure" },
    { patterns: ["Rolln", "Rol"], slugSuffix: "rollon" },
];

function skuToApplicatorSlug(sku) {
    for (const { patterns, slugSuffix } of SKU_TO_APPLICATOR_SLUG) {
        if (patterns.some((p) => sku.includes(p))) return slugSuffix;
    }
    return null; // unknown applicator type
}

function groupMatchesSku(group, uploadedSku) {
    const slug = group.slug ?? "";
    const applicatorSuffix = skuToApplicatorSlug(uploadedSku);

    // Must match capacity
    const capMl = group.capacityMl ? String(Math.round(group.capacityMl)) : null;
    if (!capMl || !uploadedSku.toLowerCase().includes(capMl)) return false;

    // Must match applicator type exactly (slug ends with the bucket suffix)
    if (!applicatorSuffix) return false;
    if (!slug.endsWith(applicatorSuffix)) return false;

    // Must match color (clear vs frosted)
    const isFrosted = uploadedSku.includes("Frst");
    const slugHasFrosted = slug.includes("frosted");
    if (isFrosted !== slugHasFrosted) return false;

    return true;
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

// ── HELPERS ───────────────────────────────────────────────────────────────────

function isPlainBackground(filename) {
    const lower = filename.toLowerCase();
    return !STYLED_BG_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractTimestamp(filename) {
    const m = filename.match(/(\d{8}_\d{6})/);
    return m ? m[1] : "00000000_000000";
}

function pickBestImage(skuDir) {
    let files;
    try { files = fs.readdirSync(skuDir); } catch { return null; }
    const candidates = files
        .filter((f) => /\.(png|jpg|jpeg)$/i.test(f) && isPlainBackground(f))
        .sort((a, b) => extractTimestamp(b).localeCompare(extractTimestamp(a)));
    return candidates.length > 0 ? path.join(skuDir, candidates[0]) : null;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n🍾  Best Bottles — Diva Grid Image Upload (v2 — strict applicator matching)");
    console.log(`📂  Grid dir  : ${GRID_DIR}`);
    console.log(`🔍  Mode      : ${DRY_RUN ? "DRY RUN" : CLEAR_WRONG ? "CLEAR WRONG ASSIGNMENTS" : "LIVE UPLOAD"}\n`);

    if (!process.env.SANITY_API_TOKEN) {
        console.error("❌  SANITY_API_TOKEN not set in .env.local");
        process.exit(1);
    }

    // ── STEP 0: Clear wrong assignments if requested ──────────────────────────
    if (CLEAR_WRONG) {
        console.log("🧹  Clearing incorrectly assigned heroImageUrls...\n");
        const divaGroups = await convex.query(api.products.getProductGroupsByFamily, { family: FAMILY_FILTER });
        let cleared = 0;
        for (const group of divaGroups ?? []) {
            if (!group.heroImageUrl) continue;
            const slug = group.slug ?? "";
            // If it ends with a non-spray applicator but has a heroImageUrl we set (spray images), clear it
            const isNonSprayGroup = ["-lotionpump", "-reducer", "-dropper", "-capclosure", "-rollon"]
                .some((s) => slug.endsWith(s));
            if (isNonSprayGroup) {
                console.log(`  🗑️  Clearing ${slug}`);
                if (!DRY_RUN) {
                    await convex.mutation(api.products.updateProductGroupHeroImage, {
                        id: group._id,
                        heroImageUrl: "",
                    });
                }
                cleared++;
            }
        }
        console.log(`\n✅  Cleared ${cleared} incorrect assignments.`);
        if (!DRY_RUN) console.log("    Re-run without --clear-wrong to do the upload.\n");
        return;
    }

    // ── STEP 1: Discover SKU subfolders ────────────────────────────────────────
    const entries = fs.readdirSync(GRID_DIR, { withFileTypes: true });
    const skuFolders = entries
        .filter((e) => e.isDirectory() && e.name.startsWith("GBDiva"))
        .map((e) => ({ sku: e.name, dir: path.join(GRID_DIR, e.name) }));

    console.log(`📋  Found ${skuFolders.length} Diva SKU subfolders\n`);

    // Show applicator breakdown of available images
    const byApplicator = {};
    for (const { sku } of skuFolders) {
        const slugSuffix = skuToApplicatorSlug(sku) ?? "unknown";
        byApplicator[slugSuffix] = [...(byApplicator[slugSuffix] ?? []), sku];
    }
    console.log("📊  Available images by applicator type:");
    for (const [type, skus] of Object.entries(byApplicator)) {
        console.log(`    ${type.padEnd(16)} → ${skus.join(", ")}`);
    }
    console.log();

    // ── STEP 2: Upload to Sanity ───────────────────────────────────────────────
    const results = [];
    let uploaded = 0;
    let skipped = 0;

    for (const { sku, dir } of skuFolders) {
        const imagePath = pickBestImage(dir);
        const applicatorSlug = skuToApplicatorSlug(sku);

        if (!imagePath) {
            console.log(`⏭️   ${sku}  — no plain-background image found`);
            skipped++;
            continue;
        }

        const filename = path.basename(imagePath);
        console.log(`📸  ${sku}  [${applicatorSlug ?? "?"}]`);
        console.log(`    ↳ ${filename}`);

        if (DRY_RUN) {
            console.log(`    [DRY RUN] Would upload → Sanity\n`);
            results.push({ sku, imagePath, applicatorSlug, sanityUrl: null, dryRun: true });
            uploaded++;
            continue;
        }

        try {
            const fileBuffer = fs.readFileSync(imagePath);
            const asset = await sanity.assets.upload("image", fileBuffer, {
                filename: `${sku}_grid.png`,
                contentType: "image/png",
            });
            const sanityUrl = asset.url;
            console.log(`    ✅ ${sanityUrl}\n`);
            results.push({ sku, imagePath, applicatorSlug, sanityUrl, assetId: asset._id });
            uploaded++;
            await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
            console.error(`    ❌ Upload failed: ${err.message}\n`);
            skipped++;
        }
    }

    console.log("─".repeat(70));
    console.log(`✅  Uploaded  : ${uploaded}   ⏭️  Skipped: ${skipped}\n`);

    if (DRY_RUN) {
        console.log("ℹ️   DRY RUN — no changes made. Remove --dry-run to execute.\n");
        return;
    }

    // ── STEP 3: Write manifest ─────────────────────────────────────────────────
    const manifestPath = path.join(__dirname, "../data/diva_sanity_upload_manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));
    console.log(`📄  Manifest → data/diva_sanity_upload_manifest.json\n`);

    // ── STEP 4: Update Convex with STRICT applicator matching ─────────────────
    console.log("📡  Updating Convex productGroups (strict applicator match)...\n");

    const divaGroups = await convex.query(api.products.getProductGroupsByFamily, { family: FAMILY_FILTER });
    console.log(`    Found ${divaGroups?.length ?? 0} Diva product groups in Convex\n`);

    let convexUpdated = 0;
    const unmatched = [];

    for (const group of divaGroups ?? []) {
        // Find an uploaded image that strictly matches this group's applicator + capacity + color
        const matched = results.find((r) => r.sanityUrl && groupMatchesSku(group, r.sku));

        if (matched) {
            const action = group.heroImageUrl ? "Updating" : "Setting ";
            console.log(`    ${action}: ${group.slug}`);
            console.log(`             ← ${matched.sku} [${matched.applicatorSlug}]`);
            try {
                await convex.mutation(api.products.updateProductGroupHeroImage, {
                    id: group._id,
                    heroImageUrl: matched.sanityUrl,
                });
                convexUpdated++;
            } catch (err) {
                console.error(`    ❌ Failed for ${group.slug}: ${err.message}`);
            }
        } else {
            unmatched.push(group.slug);
        }
    }

    // ── STEP 5: Report gaps ────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(70)}`);
    console.log(`🎉  Updated ${convexUpdated} Convex product groups with correctly matched images.\n`);

    if (unmatched.length > 0) {
        console.log(`⚠️  ${unmatched.length} groups have NO matching image yet (placeholder will show):`);
        for (const slug of unmatched) {
            // Identify which applicator is needed
            const needed = SKU_TO_APPLICATOR_SLUG.find(({ slugSuffix }) => slug.endsWith(slugSuffix));
            console.log(`    ❌ ${slug}  → needs: ${needed?.slugSuffix ?? "unknown"} image`);
        }
        console.log(`\n    To fix: generate plain-background images for the above applicator types`);
        console.log(`    in your pipeline, add them to the GBDiva* subfolders, then re-run this script.\n`);
    }
}

main().catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});
