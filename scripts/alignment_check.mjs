#!/usr/bin/env node
/**
 * alignment_check.mjs — Full SKU ↔ Collection ↔ Category Alignment Audit
 *
 * Checks:
 *   1. SKU prefix → family match (e.g. GB-CYL should be Cylinder)
 *   2. SKU prefix → category match (e.g. GB- = Glass Bottle, CMP- = Component)
 *   3. color field vs item name (frosted/white mismatch)
 *   4. bottleCollection null on glass bottle products
 *   5. Products with no productGroupId (orphans)
 *   6. productGroup family/category/collection consistency across its variants
 *   7. Variant count drift (group.variantCount vs actual linked products)
 *   8. productGroup slug vs family/capacity/color coherence
 *
 * Usage:
 *   NEXT_PUBLIC_CONVEX_URL=https://... node scripts/alignment_check.mjs
 *   NEXT_PUBLIC_CONVEX_URL=https://... node scripts/alignment_check.mjs --json > data/alignment_report.json
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL");
    process.exit(1);
}
const client = new ConvexHttpClient(CONVEX_URL);
const JSON_MODE = process.argv.includes("--json");

// ─── SKU Prefix Rules ─────────────────────────────────────────────────────────
// Maps the 2nd segment of a GB-XXX graceSku to its expected family name
const SKU_FAMILY_MAP = {
    CYL: "Cylinder",
    ELG: "Elegant",
    SLK: "Sleek",
    DVA: "Diva",
    CIR: "Circle",
    RYL: "Royal",
    SLM: "Slim",
    RCT: "Rectangle",
    BSR: "Boston Round",
    DMD: "Diamond",
    EMP: "Empire",
    GRC: "Grace",
    QEN: "Queen",
    TUL: "Tulip",
    BEL: "Bell",
    SWR: "Swirl",
    FLR: "Flair",
    // VIA is used historically for Royal/Flair/Square — multiple families, skip strict check
    // RND used for Round
    RND: "Round",
    SQR: "Square",
};

// SKU top-level prefix → expected category
const SKU_CATEGORY_MAP = {
    GB: "Glass Bottle",
    CMP: "Component",         // Component / Cap / Sprayer / Dropper / Roll-On etc.
    JAR: "Cream Jar",
    LOT: "Lotion Bottle",
    ALU: "Aluminum Bottle",
    GBA: "Glass Bottle",      // GBA prefix for Atomizer GB products (GBAtom* in websiteSku)
};

// Families we expect to have a bottleCollection
const BOTTLE_CATEGORIES = new Set(["Glass Bottle", "Cream Jar", "Lotion Bottle"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractSkuSegments(graceSku) {
    if (!graceSku) return { topLevel: null, familyCode: null };
    const parts = graceSku.split("-");
    if (parts.length < 2) return { topLevel: null, familyCode: null };
    const topLevel = parts[0].toUpperCase();
    const familyCode = parts[1]?.toUpperCase() ?? null;
    return { topLevel, familyCode };
}

function colorMentionedInName(itemName, color) {
    if (!itemName || !color) return false;
    const name = itemName.toLowerCase();
    const c = color.toLowerCase();
    return name.includes(c);
}

function detectExpectedColorFromName(itemName) {
    if (!itemName) return null;
    const name = itemName.toLowerCase();
    // Check for frosted (before clear to avoid false negative)
    if (name.includes("frosted")) return "Frosted";
    if (name.includes("amber")) return "Amber";
    if (name.includes("cobalt blue")) return "Cobalt Blue";
    if (name.includes("cobalt")) return "Cobalt Blue";
    if (name.includes("blue")) return "Blue";
    if (name.includes("green")) return "Green";
    if (name.includes("black") && name.includes("glass")) return "Black";
    if (name.includes("red") && name.includes("glass")) return "Red";
    if (name.includes("white") && name.includes("glass")) return "White";
    if (name.includes("pink") && name.includes("glass")) return "Pink";
    if (name.includes("opal") && name.includes("glass")) return "Opal";
    if (name.includes("clear")) return "Clear";
    return null;
}

// ─── Fetch all data with pagination ───────────────────────────────────────────
async function fetchAllProducts() {
    const all = [];
    let cursor = null;
    let page = 0;
    while (true) {
        page++;
        if (!JSON_MODE) process.stdout.write(`\r  Fetching page ${page}... (${all.length} products so far)`);
        const result = await client.action(api.products.getProductExportPage, {
            cursor,
            numItems: 200,
        });
        all.push(...result.page);
        if (result.isDone) break;
        cursor = result.continueCursor;
    }
    if (!JSON_MODE) console.log(`\r  Fetched ${all.length} products across ${page} pages.           `);
    return all;
}

async function fetchAllGroups() {
    return await client.query(api.products.getAllCatalogGroups);
}

// ─── Main Audit ───────────────────────────────────────────────────────────────
async function main() {
    if (!JSON_MODE) {
        console.log("╔═══════════════════════════════════════════════════════╗");
        console.log("║   FULL ALIGNMENT CHECK — Best Bottles (SKU+Collection) ║");
        console.log("╚═══════════════════════════════════════════════════════╝\n");
        console.log("Fetching all products from Convex (paginated)...");
    }

    const [products, groups] = await Promise.all([fetchAllProducts(), fetchAllGroups()]);

    if (!JSON_MODE) {
        console.log(`\nLoaded ${products.length} products, ${groups.length} product groups.\n`);
    }

    // Index groups by their Convex _id
    const groupById = new Map(groups.map((g) => [String(g._id), g]));

    // Index products by groupId
    const productsByGroupId = new Map();
    for (const p of products) {
        const gid = p.productGroupId ? String(p.productGroupId) : null;
        if (gid) {
            if (!productsByGroupId.has(gid)) productsByGroupId.set(gid, []);
            productsByGroupId.get(gid).push(p);
        }
    }

    const findings = {
        generatedAt: new Date().toISOString(),
        summary: {
            totalProducts: products.length,
            totalGroups: groups.length,
        },
        checks: {
            sku_family_mismatch: [],        // Check 1
            sku_category_mismatch: [],      // Check 2
            color_name_mismatch: [],        // Check 3
            missing_collection: [],         // Check 4
            orphan_products: [],            // Check 5
            group_variant_inconsistency: [],// Check 6
            group_count_drift: [],          // Check 7
            group_slug_incoherence: [],     // Check 8
        },
    };

    // ── Check 1 & 2: SKU prefix vs family/category ────────────────────────────
    for (const p of products) {
        const { topLevel, familyCode } = extractSkuSegments(p.graceSku);
        const family = p.family;
        const category = p.category;

        // Check 1: SKU family code vs product family
        if (topLevel === "GB" && familyCode && SKU_FAMILY_MAP[familyCode]) {
            const expectedFamily = SKU_FAMILY_MAP[familyCode];
            if (family && family !== expectedFamily) {
                findings.checks.sku_family_mismatch.push({
                    graceSku: p.graceSku,
                    websiteSku: p.websiteSku,
                    itemName: (p.itemName ?? "").substring(0, 80),
                    skuImpliedFamily: expectedFamily,
                    actualFamily: family,
                    category,
                    bottleCollection: p.bottleCollection,
                });
            }
        }

        // Check 2: SKU top-level prefix vs category
        if (topLevel && SKU_CATEGORY_MAP[topLevel]) {
            const expectedCategory = SKU_CATEGORY_MAP[topLevel];
            if (category && category !== expectedCategory) {
                findings.checks.sku_category_mismatch.push({
                    graceSku: p.graceSku,
                    websiteSku: p.websiteSku,
                    itemName: (p.itemName ?? "").substring(0, 80),
                    skuImpliedCategory: expectedCategory,
                    actualCategory: category,
                    family,
                    bottleCollection: p.bottleCollection,
                });
            }
        }

        // Check 3: color field vs item name description
        const colorField = p.color;
        const itemName = p.itemName ?? "";
        if (colorField && BOTTLE_CATEGORIES.has(category)) {
            const nameImpliedColor = detectExpectedColorFromName(itemName);
            // Only flag when name is unambiguous AND contradicts the stored color
            if (nameImpliedColor && nameImpliedColor !== colorField) {
                // Avoid false positives: "Clear" glass with white cap isn't "White" glass
                // Only flag when the name explicitly mentions a glass color word that differs
                const glassMentions = ["frosted glass", "amber glass", "blue glass", "cobalt blue glass",
                    "green glass", "clear glass", "black glass", "red glass", "white glass", "pink glass"];
                const nameHasGlassColor = glassMentions.some((m) => itemName.toLowerCase().includes(m));
                const frostedMention = itemName.toLowerCase().includes("frosted glass");
                const clearGlass = itemName.toLowerCase().includes("clear glass");

                if (frostedMention && colorField !== "Frosted") {
                    findings.checks.color_name_mismatch.push({
                        graceSku: p.graceSku,
                        websiteSku: p.websiteSku,
                        itemName: itemName.substring(0, 100),
                        storedColor: colorField,
                        nameImpliedColor: "Frosted",
                        family,
                        bottleCollection: p.bottleCollection,
                        severity: "high",
                    });
                } else if (clearGlass && colorField === "Frosted") {
                    findings.checks.color_name_mismatch.push({
                        graceSku: p.graceSku,
                        websiteSku: p.websiteSku,
                        itemName: itemName.substring(0, 100),
                        storedColor: colorField,
                        nameImpliedColor: "Clear",
                        family,
                        bottleCollection: p.bottleCollection,
                        severity: "high",
                    });
                } else if (nameHasGlassColor && nameImpliedColor !== colorField) {
                    findings.checks.color_name_mismatch.push({
                        graceSku: p.graceSku,
                        websiteSku: p.websiteSku,
                        itemName: itemName.substring(0, 100),
                        storedColor: colorField,
                        nameImpliedColor,
                        family,
                        bottleCollection: p.bottleCollection,
                        severity: "medium",
                    });
                }
            }
        }

        // Check 4: missing collection on bottle products
        if (BOTTLE_CATEGORIES.has(category) && !p.bottleCollection) {
            findings.checks.missing_collection.push({
                graceSku: p.graceSku,
                websiteSku: p.websiteSku,
                itemName: (p.itemName ?? "").substring(0, 80),
                category,
                family,
            });
        }

        // Check 5: orphan products (no productGroupId)
        if (!p.productGroupId) {
            findings.checks.orphan_products.push({
                graceSku: p.graceSku,
                websiteSku: p.websiteSku,
                itemName: (p.itemName ?? "").substring(0, 80),
                category,
                family,
                bottleCollection: p.bottleCollection,
            });
        }
    }

    // ── Check 6, 7, 8: product group consistency ──────────────────────────────
    for (const g of groups) {
        const gid = String(g._id);
        const variants = productsByGroupId.get(gid) ?? [];

        // Check 6: are all variants consistent in family/category/collection?
        const families = new Set(variants.map((v) => v.family).filter(Boolean));
        const categories = new Set(variants.map((v) => v.category).filter(Boolean));
        const collections = new Set(variants.map((v) => v.bottleCollection).filter(Boolean));

        if (families.size > 1) {
            findings.checks.group_variant_inconsistency.push({
                groupSlug: g.slug,
                groupFamily: g.family,
                groupCollection: g.bottleCollection,
                issue: "mixed_families",
                values: [...families],
                variantCount: variants.length,
            });
        }
        if (categories.size > 1) {
            findings.checks.group_variant_inconsistency.push({
                groupSlug: g.slug,
                groupFamily: g.family,
                groupCollection: g.bottleCollection,
                issue: "mixed_categories",
                values: [...categories],
                variantCount: variants.length,
            });
        }
        if (collections.size > 1) {
            findings.checks.group_variant_inconsistency.push({
                groupSlug: g.slug,
                groupFamily: g.family,
                groupCollection: g.bottleCollection,
                issue: "mixed_collections",
                values: [...collections],
                variantCount: variants.length,
            });
        }

        // Check 6b: group's own metadata vs variants' metadata
        if (families.size === 1) {
            const actualFamily = [...families][0];
            if (g.family && actualFamily && g.family !== actualFamily) {
                findings.checks.group_variant_inconsistency.push({
                    groupSlug: g.slug,
                    groupFamily: g.family,
                    groupCollection: g.bottleCollection,
                    issue: "group_family_vs_variants",
                    detail: `Group says '${g.family}' but variants say '${actualFamily}'`,
                    variantCount: variants.length,
                });
            }
        }
        if (collections.size === 1) {
            const actualCollection = [...collections][0];
            if (g.bottleCollection && actualCollection && g.bottleCollection !== actualCollection) {
                findings.checks.group_variant_inconsistency.push({
                    groupSlug: g.slug,
                    groupFamily: g.family,
                    groupCollection: g.bottleCollection,
                    issue: "group_collection_vs_variants",
                    detail: `Group says '${g.bottleCollection}' but variants say '${actualCollection}'`,
                    variantCount: variants.length,
                });
            }
        }

        // Check 7: variantCount drift
        const expectedCount = g.variantCount ?? 0;
        const actualCount = variants.length;
        if (actualCount !== expectedCount) {
            findings.checks.group_count_drift.push({
                groupSlug: g.slug,
                groupFamily: g.family,
                groupCollection: g.bottleCollection,
                storedCount: expectedCount,
                actualCount,
                delta: actualCount - expectedCount,
            });
        }

        // Check 8: slug coherence (does slug contain family/color/capacity tokens?)
        const slug = g.slug ?? "";
        const slugLower = slug.toLowerCase().replace(/-/g, " ");
        const groupFamily = (g.family ?? "").toLowerCase().replace(/ /g, " ");
        const groupCapacity = g.capacityMl ? `${g.capacityMl}ml` : null;
        const groupColor = (g.color ?? "").toLowerCase();

        const slugHasFamily = groupFamily && slugLower.includes(groupFamily.split(" ")[0]);
        const slugHasCapacity = groupCapacity && slugLower.includes(groupCapacity);
        const slugHasColor = groupColor && slugLower.includes(groupColor);

        if (groupFamily && !slugHasFamily) {
            findings.checks.group_slug_incoherence.push({
                groupSlug: slug,
                groupFamily: g.family,
                groupColor: g.color,
                groupCapacity: g.capacity,
                groupCollection: g.bottleCollection,
                issue: "slug_missing_family",
            });
        } else if (groupCapacity && !slugHasCapacity) {
            findings.checks.group_slug_incoherence.push({
                groupSlug: slug,
                groupFamily: g.family,
                groupColor: g.color,
                groupCapacity: g.capacity,
                groupCollection: g.bottleCollection,
                issue: "slug_missing_capacity",
            });
        }
    }

    // ── Summarize ─────────────────────────────────────────────────────────────
    findings.summary.checkResults = {
        sku_family_mismatch: findings.checks.sku_family_mismatch.length,
        sku_category_mismatch: findings.checks.sku_category_mismatch.length,
        color_name_mismatch: findings.checks.color_name_mismatch.length,
        missing_collection: findings.checks.missing_collection.length,
        orphan_products: findings.checks.orphan_products.length,
        group_variant_inconsistency: findings.checks.group_variant_inconsistency.length,
        group_count_drift: findings.checks.group_count_drift.length,
        group_slug_incoherence: findings.checks.group_slug_incoherence.length,
    };

    // ── Collection taxonomy snapshot ───────────────────────────────────────────
    const collectionCounts = {};
    const collectionFamilies = {};
    for (const g of groups) {
        const col = g.bottleCollection || "(none)";
        collectionCounts[col] = (collectionCounts[col] || 0) + (g.variantCount ?? 1);
        if (!collectionFamilies[col]) collectionFamilies[col] = new Set();
        if (g.family) collectionFamilies[col].add(g.family);
    }
    findings.collectionTaxonomy = Object.entries(collectionCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([collection, skuCount]) => ({
            collection,
            skuCount,
            families: [...(collectionFamilies[collection] ?? [])].sort(),
            groupCount: groups.filter((g) => (g.bottleCollection || "(none)") === collection).length,
        }));

    // ── Output ────────────────────────────────────────────────────────────────
    if (JSON_MODE) {
        console.log(JSON.stringify(findings, null, 2));
        return;
    }

    const { checkResults } = findings.summary;

    console.log("═══════════════════════════════════════════════════════");
    console.log(" RESULTS SUMMARY");
    console.log("═══════════════════════════════════════════════════════");
    const icon = (n) => n === 0 ? "✅" : "⚠️ ";
    console.log(`  ${icon(checkResults.sku_family_mismatch)} [1] SKU→Family mismatches:         ${checkResults.sku_family_mismatch}`);
    console.log(`  ${icon(checkResults.sku_category_mismatch)} [2] SKU→Category mismatches:       ${checkResults.sku_category_mismatch}`);
    console.log(`  ${icon(checkResults.color_name_mismatch)} [3] Color/Name mismatches:          ${checkResults.color_name_mismatch}`);
    console.log(`  ${icon(checkResults.missing_collection)} [4] Products missing collection:    ${checkResults.missing_collection}`);
    console.log(`  ${icon(checkResults.orphan_products)} [5] Orphan products (no group):     ${checkResults.orphan_products}`);
    console.log(`  ${icon(checkResults.group_variant_inconsistency)} [6] Group inconsistency issues:    ${checkResults.group_variant_inconsistency}`);
    console.log(`  ${icon(checkResults.group_count_drift)} [7] Group variantCount drift:       ${checkResults.group_count_drift}`);
    console.log(`  ${icon(checkResults.group_slug_incoherence)} [8] Group slug incoherence:        ${checkResults.group_slug_incoherence}`);
    console.log("");

    // ── Collection Taxonomy ───────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════");
    console.log(" COLLECTION TAXONOMY (by SKU count)");
    console.log("═══════════════════════════════════════════════════════");
    for (const row of findings.collectionTaxonomy) {
        const noCol = row.collection === "(none)";
        const tag = noCol ? " ← NO COLLECTION" : "";
        console.log(`  ${row.skuCount.toString().padStart(4)} SKUs  ${row.groupCount.toString().padStart(3)} groups  ${row.collection}${tag}`);
        if (row.families.length) {
            console.log(`           Families: ${row.families.join(", ")}`);
        }
    }
    console.log("");

    // ── Detail: Check 1 ───────────────────────────────────────────────────────
    if (findings.checks.sku_family_mismatch.length) {
        console.log("═══════════════════════════════════════════════════════");
        console.log(` CHECK 1 — SKU → FAMILY MISMATCHES (${findings.checks.sku_family_mismatch.length})`);
        console.log("═══════════════════════════════════════════════════════");
        for (const f of findings.checks.sku_family_mismatch) {
            console.log(`  🔴 ${f.graceSku}`);
            console.log(`     SKU implies: ${f.skuImpliedFamily}  |  Stored family: ${f.actualFamily}`);
            console.log(`     Collection: ${f.bottleCollection ?? "(none)"}`);
            console.log(`     Name: ${f.itemName}`);
        }
        console.log("");
    }

    // ── Detail: Check 2 ───────────────────────────────────────────────────────
    if (findings.checks.sku_category_mismatch.length) {
        console.log("═══════════════════════════════════════════════════════");
        console.log(` CHECK 2 — SKU → CATEGORY MISMATCHES (${findings.checks.sku_category_mismatch.length})`);
        console.log("═══════════════════════════════════════════════════════");
        for (const f of findings.checks.sku_category_mismatch) {
            console.log(`  🔴 ${f.graceSku}`);
            console.log(`     SKU implies: ${f.skuImpliedCategory}  |  Stored category: ${f.actualCategory}`);
            console.log(`     Family: ${f.family ?? "(none)"}  |  Collection: ${f.bottleCollection ?? "(none)"}`);
            console.log(`     Name: ${f.itemName}`);
        }
        console.log("");
    }

    // ── Detail: Check 3 ───────────────────────────────────────────────────────
    if (findings.checks.color_name_mismatch.length) {
        console.log("═══════════════════════════════════════════════════════");
        console.log(` CHECK 3 — COLOR / NAME MISMATCHES (${findings.checks.color_name_mismatch.length})`);
        console.log("═══════════════════════════════════════════════════════");
        const high = findings.checks.color_name_mismatch.filter(f => f.severity === "high");
        const med = findings.checks.color_name_mismatch.filter(f => f.severity === "medium");
        if (high.length) {
            console.log(`  HIGH severity (${high.length}):`);
            for (const f of high) {
                console.log(`    🔴 ${f.graceSku} (${f.websiteSku})`);
                console.log(`       Stored: "${f.storedColor}"  |  Name implies: "${f.nameImpliedColor}"`);
                console.log(`       ${f.itemName}`);
            }
        }
        if (med.length) {
            console.log(`\n  MEDIUM severity (${med.length}):`);
            for (const f of med.slice(0, 20)) {
                console.log(`    🟡 ${f.graceSku} (${f.websiteSku})`);
                console.log(`       Stored: "${f.storedColor}"  |  Name implies: "${f.nameImpliedColor}"`);
            }
            if (med.length > 20) console.log(`    ... and ${med.length - 20} more`);
        }
        console.log("");
    }

    // ── Detail: Check 4 ───────────────────────────────────────────────────────
    if (findings.checks.missing_collection.length) {
        console.log("═══════════════════════════════════════════════════════");
        console.log(` CHECK 4 — BOTTLE PRODUCTS MISSING bottleCollection (${findings.checks.missing_collection.length})`);
        console.log("═══════════════════════════════════════════════════════");
        // Group by family
        const byFamily = {};
        for (const f of findings.checks.missing_collection) {
            const fam = f.family ?? "(no family)";
            if (!byFamily[fam]) byFamily[fam] = [];
            byFamily[fam].push(f);
        }
        for (const [fam, items] of Object.entries(byFamily)) {
            console.log(`  Family: ${fam} (${items.length} products)`);
            for (const f of items.slice(0, 5)) {
                console.log(`    🔴 ${f.graceSku}  ${f.itemName}`);
            }
            if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);
        }
        console.log("");
    }

    // ── Detail: Check 5 ───────────────────────────────────────────────────────
    if (findings.checks.orphan_products.length) {
        console.log("═══════════════════════════════════════════════════════");
        console.log(` CHECK 5 — ORPHAN PRODUCTS (no productGroupId) (${findings.checks.orphan_products.length})`);
        console.log("═══════════════════════════════════════════════════════");
        const byCat = {};
        for (const f of findings.checks.orphan_products) {
            const cat = f.category ?? "Unknown";
            if (!byCat[cat]) byCat[cat] = [];
            byCat[cat].push(f);
        }
        for (const [cat, items] of Object.entries(byCat)) {
            console.log(`  Category: ${cat} (${items.length} orphans)`);
            for (const f of items.slice(0, 5)) {
                console.log(`    🟡 ${f.graceSku}  ${(f.itemName ?? "").substring(0, 60)}`);
            }
            if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);
        }
        console.log("");
    }

    // ── Detail: Check 6 ───────────────────────────────────────────────────────
    if (findings.checks.group_variant_inconsistency.length) {
        console.log("═══════════════════════════════════════════════════════");
        console.log(` CHECK 6 — GROUP INCONSISTENCY (${findings.checks.group_variant_inconsistency.length})`);
        console.log("═══════════════════════════════════════════════════════");
        for (const f of findings.checks.group_variant_inconsistency) {
            console.log(`  🟡 ${f.groupSlug} [${f.issue}]`);
            if (f.values) console.log(`     Values found: ${f.values.join(", ")}`);
            if (f.detail) console.log(`     ${f.detail}`);
        }
        console.log("");
    }

    // ── Detail: Check 7 ───────────────────────────────────────────────────────
    if (findings.checks.group_count_drift.length) {
        console.log("═══════════════════════════════════════════════════════");
        console.log(` CHECK 7 — GROUP VARIANTCOUNT DRIFT (${findings.checks.group_count_drift.length})`);
        console.log("═══════════════════════════════════════════════════════");
        for (const f of findings.checks.group_count_drift) {
            const delta = f.delta > 0 ? `+${f.delta}` : `${f.delta}`;
            console.log(`  🟡 ${f.groupSlug}  stored=${f.storedCount}  actual=${f.actualCount}  drift=${delta}`);
        }
        console.log("");
    }

    // ── Detail: Check 8 ───────────────────────────────────────────────────────
    if (findings.checks.group_slug_incoherence.length) {
        console.log("═══════════════════════════════════════════════════════");
        console.log(` CHECK 8 — GROUP SLUG INCOHERENCE (${findings.checks.group_slug_incoherence.length})`);
        console.log("═══════════════════════════════════════════════════════");
        for (const f of findings.checks.group_slug_incoherence.slice(0, 20)) {
            console.log(`  🔵 ${f.groupSlug} [${f.issue}]`);
            console.log(`     family=${f.groupFamily}  color=${f.groupColor}  cap=${f.groupCapacity}`);
        }
        if (findings.checks.group_slug_incoherence.length > 20) {
            console.log(`  ... and ${findings.checks.group_slug_incoherence.length - 20} more`);
        }
        console.log("");
    }

    console.log("═══════════════════════════════════════════════════════");
    console.log(" ALIGNMENT CHECK COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
    const totalIssues = Object.values(checkResults).reduce((a, b) => a + b, 0);
    console.log(`  Total issues found: ${totalIssues}`);
    if (totalIssues === 0) {
        console.log("  ✅ All alignment checks passed!");
    } else {
        console.log(`  Run with --json flag to export full report to data/alignment_report.json`);
        console.log(`    NEXT_PUBLIC_CONVEX_URL=... node scripts/alignment_check.mjs --json > data/alignment_report.json`);
    }
}

main().catch(console.error);
