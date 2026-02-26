#!/usr/bin/env node

/**
 * Convex → Shopify Product Sync
 *
 * Reads all productGroups + variants from Convex and syncs them to Shopify
 * as products with variants. Idempotent: safe to run multiple times.
 *
 * Prerequisites:
 *   - SHOPIFY_ADMIN_TOKEN with read_products, write_products scopes
 *   - NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN set in .env.local
 *   - NEXT_PUBLIC_CONVEX_URL set in .env.local
 *
 * Usage:
 *   node scripts/shopify-sync.mjs [--dry-run] [--family <FamilyName>]
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local without requiring dotenv
const envPath = resolve(import.meta.dirname ?? ".", "..", ".env.local");
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
} catch { /* .env.local is optional if vars are set externally */ }

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SHOPIFY_DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2025-01";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const familyIdx = args.indexOf("--family");
const FAMILY_FILTER = familyIdx >= 0 ? args[familyIdx + 1] : null;

if (!CONVEX_URL || !SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
    console.error("Missing env vars. Check .env.local for NEXT_PUBLIC_CONVEX_URL, NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN");
    process.exit(1);
}

// ─── Convex HTTP Client ─────────────────────────────────────────────────────

async function convexQuery(functionPath, args = {}) {
    const url = new URL(`/api/query`, CONVEX_URL);
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: functionPath, args, format: "json" }),
    });
    if (!res.ok) throw new Error(`Convex query failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.value;
}

// ─── Shopify Admin API ──────────────────────────────────────────────────────

async function shopifyRest(method, endpoint, body = null) {
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}${endpoint}`;
    const opts = {
        method,
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify ${method} ${endpoint}: ${res.status} — ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

async function shopifyGraphQL(query, variables = {}) {
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify GQL ${res.status}: ${text}`);
    }
    const json = await res.json();
    if (json.errors?.length) {
        throw new Error(`Shopify GQL errors: ${json.errors.map(e => e.message).join(", ")}`);
    }
    return json.data;
}

// ─── Rate limit helper ──────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let requestCount = 0;
async function throttle() {
    requestCount++;
    if (requestCount % 2 === 0) await sleep(600);
}

// ─── Fetch existing Shopify products for matching ───────────────────────────

async function fetchAllShopifyProducts() {
    console.log("  Fetching existing Shopify products...");
    const products = [];
    let pageInfo = null;
    let hasNext = true;

    while (hasNext) {
        const cursor = pageInfo ? `, after: "${pageInfo}"` : "";
        const data = await shopifyGraphQL(`{
            products(first: 100${cursor}) {
                edges {
                    node {
                        id
                        title
                        handle
                        variants(first: 100) {
                            edges {
                                node {
                                    id
                                    sku
                                    price
                                    title
                                }
                            }
                        }
                    }
                    cursor
                }
                pageInfo { hasNextPage }
            }
        }`);

        const edges = data.products.edges;
        for (const edge of edges) {
            products.push(edge.node);
            pageInfo = edge.cursor;
        }
        hasNext = data.products.pageInfo.hasNextPage;
        await throttle();
    }

    console.log(`  Found ${products.length} existing Shopify products`);
    return products;
}

// ─── Build Shopify product from Convex group + variants ─────────────────────

function buildShopifyProduct(group, variants) {
    const title = group.displayName;
    const bodyHtml = [
        `<p>Premium ${group.family} bottle — ${group.capacity ?? ""}${group.color ? `, ${group.color}` : ""}.</p>`,
        group.neckThreadSize ? `<p>Thread size: ${group.neckThreadSize}</p>` : "",
    ].filter(Boolean).join("\n");

    const shopifyVariants = variants
        .filter(v => v.category === "Bottle")
        .slice(0, 100) // Shopify limit
        .map(v => ({
            sku: v.graceSku,
            price: v.webPrice1pc ? String(v.webPrice1pc.toFixed(2)) : "0.00",
            title: [v.applicator, v.trimColor].filter(Boolean).join(" — ") || "Default",
            inventory_management: null,
            requires_shipping: true,
            taxable: true,
        }));

    if (shopifyVariants.length === 0) {
        shopifyVariants.push({
            sku: group.slug,
            price: group.priceRangeMin ? String(group.priceRangeMin.toFixed(2)) : "0.00",
            title: "Default",
            inventory_management: null,
            requires_shipping: true,
            taxable: true,
        });
    }

    return {
        title,
        body_html: bodyHtml,
        vendor: "Best Bottles",
        product_type: group.family ?? "Bottle",
        tags: [
            group.family,
            group.category,
            group.bottleCollection,
            group.capacity,
            group.color,
        ].filter(Boolean).join(", "),
        handle: group.slug,
        variants: shopifyVariants,
    };
}

// ─── Match Convex group to existing Shopify product ─────────────────────────

function findShopifyMatch(group, existingProducts) {
    return existingProducts.find(p =>
        p.handle === group.slug ||
        p.title.toLowerCase() === group.displayName.toLowerCase()
    );
}

// ─── Main sync logic ────────────────────────────────────────────────────────

async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Convex → Shopify Product Sync");
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
    if (FAMILY_FILTER) console.log(`  Filter: family="${FAMILY_FILTER}"`);
    console.log(`  Store: ${SHOPIFY_DOMAIN}`);
    console.log("═══════════════════════════════════════════════════════\n");

    // 1. Verify Shopify access
    console.log("Step 1: Verifying Shopify API access...");
    try {
        await shopifyRest("GET", "/products/count.json");
        console.log("  ✓ Shopify token is valid\n");
    } catch (err) {
        console.error(`  ✗ Shopify access failed: ${err.message}`);
        console.error("  → Go to Shopify Admin > Settings > Apps > your app > API scopes");
        console.error("  → Add: read_products, write_products, read_inventory");
        process.exit(1);
    }

    // 2. Load Convex productGroups
    console.log("Step 2: Loading Convex product groups...");
    let groups = await convexQuery("products:getCatalogGroups", {
        limit: 500,
        ...(FAMILY_FILTER ? { family: FAMILY_FILTER } : {}),
    });
    console.log(`  Loaded ${groups.length} product groups\n`);

    // 3. Load Shopify products
    console.log("Step 3: Loading Shopify product catalog...");
    const existingProducts = await fetchAllShopifyProducts();
    console.log();

    // 4. Process each group
    console.log("Step 4: Syncing products...\n");
    const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };

    for (const group of groups) {
        const match = findShopifyMatch(group, existingProducts);

        // Load variants from Convex
        let variants = [];
        try {
            variants = await convexQuery("products:getVariantsForGroup", {
                groupId: group._id,
            });
        } catch {
            // If getVariantsForGroup isn't deployed, skip variant loading
            console.log(`  ⚠ Could not load variants for ${group.slug}, using group-level data`);
        }

        const productPayload = buildShopifyProduct(group, variants);

        if (match) {
            // Compare — skip if unchanged
            const existingSkus = match.variants.edges.map(e => e.node.sku).sort().join(",");
            const newSkus = productPayload.variants.map(v => v.sku).sort().join(",");

            if (existingSkus === newSkus && match.title === productPayload.title) {
                stats.skipped++;
                continue;
            }

            console.log(`  ↻ UPDATE: ${group.displayName} (Shopify ID: ${match.id})`);

            if (!DRY_RUN) {
                try {
                    const numericId = match.id.split("/").pop();
                    await shopifyRest("PUT", `/products/${numericId}.json`, {
                        product: {
                            id: Number(numericId),
                            title: productPayload.title,
                            body_html: productPayload.body_html,
                            tags: productPayload.tags,
                            product_type: productPayload.product_type,
                        },
                    });
                    await throttle();
                    stats.updated++;
                } catch (err) {
                    console.error(`    ✗ Error updating: ${err.message}`);
                    stats.errors++;
                }
            } else {
                stats.updated++;
            }
        } else {
            console.log(`  + CREATE: ${group.displayName}`);

            if (!DRY_RUN) {
                try {
                    const result = await shopifyRest("POST", "/products.json", {
                        product: productPayload,
                    });
                    await throttle();

                    const shopifyId = String(result.product.id);
                    console.log(`    → Shopify product ID: ${shopifyId}`);
                    stats.created++;
                } catch (err) {
                    console.error(`    ✗ Error creating: ${err.message}`);
                    stats.errors++;
                }
            } else {
                stats.created++;
            }
        }
    }

    // 5. Summary
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Sync Complete");
    console.log(`  Created:  ${stats.created}`);
    console.log(`  Updated:  ${stats.updated}`);
    console.log(`  Skipped:  ${stats.skipped} (already in sync)`);
    console.log(`  Errors:   ${stats.errors}`);
    console.log("═══════════════════════════════════════════════════════");

    if (DRY_RUN) {
        console.log("\n  ℹ This was a DRY RUN. No changes were made to Shopify.");
        console.log("  Run without --dry-run to apply changes.\n");
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
