#!/usr/bin/env node
/**
 * Backfill Shopify variant / product IDs onto Convex records.
 *
 * Pulls every product + variant from Shopify Admin API, builds a mapping of
 *   handle (slug) → Shopify product GID
 *   sku             → Shopify variant GID + inventoryItem GID
 * and patches:
 *   productGroups.shopifyProductId
 *   products.shopifyVariantId
 *   products.shopifyInventoryItemId
 *
 * Does NOT touch any other catalog fields. Idempotent — skips records already
 * linked to the same GID.
 *
 * Usage:
 *   node scripts/backfill_shopify_ids.mjs                         # dry-run everything
 *   node scripts/backfill_shopify_ids.mjs --family Empire         # dry-run, Empire only
 *   node scripts/backfill_shopify_ids.mjs --apply --family Empire # apply, Empire only
 *   node scripts/backfill_shopify_ids.mjs --apply                 # apply everything
 *
 * --family filters by title prefix on the Shopify side (Shopify titles start
 * with "{size} {color} {family}..."). Safer to run scoped first.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Load .env.local ──────────────────────────────────────────────────────────
try {
    const envPath = resolve(ROOT, ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) {
            const key = m[1].trim();
            if (process.env[key] == null) {
                process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
            }
        }
    }
} catch { /* ok */ }

// ── Args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argVal(name) {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    return v && !v.startsWith("--") ? v : undefined;
}
const args = {
    apply: argv.includes("--apply"),
    family: argVal("--family"),
    limit: Number(argVal("--limit")) || undefined,
};

// ── Colors ───────────────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", B = "\x1b[1m", X = "\x1b[0m";
const ok = (s) => console.log(`${G}✓${X} ${s}`);
const fail = (s) => console.log(`${R}✗${X} ${s}`);
const info = (s) => console.log(`${D}  ${s}${X}`);
const warn = (s) => console.log(`${Y}⚠${X} ${s}`);
const section = (s) => console.log(`\n${B}${s}${X}`);

// ── Env check ────────────────────────────────────────────────────────────────
const REQ = ["NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN", "NEXT_PUBLIC_CONVEX_URL"];
const missing = REQ.filter((k) => !process.env[k]);
if (missing.length) { fail(`Missing env: ${missing.join(", ")}`); process.exit(1); }

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2025-01";

async function shopify(query, variables) {
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_TOKEN },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) throw new Error(`GQL: ${json.errors.map((e) => e.message).join("; ")}`);
    return json.data;
}

// ── Step 1: Pull all products + variants from Shopify ────────────────────────
section("1. Pulling Shopify products");
info(`Store: ${SHOPIFY_DOMAIN}`);
if (args.family) info(`Family filter: ${args.family}`);

const PRODUCTS_QUERY = `
query AllProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
        edges {
            cursor
            node {
                id
                handle
                title
                variants(first: 100) {
                    edges {
                        node {
                            id
                            sku
                            inventoryItem { id }
                        }
                    }
                }
            }
        }
        pageInfo { hasNextPage endCursor }
    }
}`;

/** Shopify query-string filter — title-prefix style match for the family. */
const shopifyQuery = args.family ? `title:*${args.family}*` : undefined;

const groupPatches = []; // { slug, shopifyProductId }
const variantPatches = []; // { sku, shopifyVariantId, shopifyInventoryItemId }

let cursor = undefined;
let productsSeen = 0;
for (;;) {
    const data = await shopify(PRODUCTS_QUERY, { first: 50, after: cursor, query: shopifyQuery });
    for (const edge of data.products.edges) {
        const p = edge.node;
        productsSeen++;
        if (p.handle) {
            groupPatches.push({ slug: p.handle, shopifyProductId: p.id });
        }
        for (const v of p.variants.edges) {
            if (v.node.sku) {
                variantPatches.push({
                    sku: v.node.sku,
                    shopifyVariantId: v.node.id,
                    shopifyInventoryItemId: v.node.inventoryItem?.id ?? undefined,
                });
            }
        }
        if (args.limit && productsSeen >= args.limit) break;
    }
    if (args.limit && productsSeen >= args.limit) break;
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
}

ok(`Pulled ${productsSeen} Shopify products → ${groupPatches.length} group patches, ${variantPatches.length} variant patches`);

if (!args.apply) {
    section("2. DRY RUN — sample patches");
    console.log(`\n${D}First 3 group patches:${X}`);
    for (const p of groupPatches.slice(0, 3)) console.log("  ", p);
    console.log(`\n${D}First 5 variant patches:${X}`);
    for (const p of variantPatches.slice(0, 5)) console.log("  ", p);
    console.log();
    warn("Dry run only. Re-run with --apply to write.");
    process.exit(0);
}

// ── Step 2: Apply to Convex ──────────────────────────────────────────────────
section("2. Applying to Convex");

const { ConvexHttpClient } = await import("convex/browser");
const { api } = await import("../convex/_generated/api.js");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function applyBatches(items, batchSize, runFn, label) {
    let totalUpdated = 0, totalAlready = 0, totalNotFound = 0;
    const notFoundAll = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchIndex = Math.floor(i / batchSize);
        const res = await runFn(batch, batchIndex);
        totalUpdated += res.updated;
        totalAlready += res.alreadyLinked;
        totalNotFound += res.notFound;
        if (res.notFoundSample?.length) notFoundAll.push(...res.notFoundSample);
        info(`${label} batch ${batchIndex + 1}/${Math.ceil(items.length / batchSize)}: +${res.updated} updated, ${res.alreadyLinked} already linked, ${res.notFound} not found`);
    }
    return { totalUpdated, totalAlready, totalNotFound, notFoundSample: notFoundAll.slice(0, 20) };
}

info("Patching productGroups...");
const groupResult = await applyBatches(
    groupPatches,
    100,
    (batch, batchIndex) => convex.action(api.backfillShopifyIds.applyGroupBatch, { patches: batch, batchIndex }),
    "Group",
);
ok(`productGroups: ${groupResult.totalUpdated} updated, ${groupResult.totalAlready} already linked, ${groupResult.totalNotFound} not found`);
if (groupResult.notFoundSample.length) warn(`Not-found slugs (sample): ${groupResult.notFoundSample.join(", ")}`);

info("Patching products...");
const variantResult = await applyBatches(
    variantPatches,
    100,
    (batch, batchIndex) => convex.action(api.backfillShopifyIds.applyVariantBatch, { patches: batch, batchIndex }),
    "Variant",
);
ok(`products: ${variantResult.totalUpdated} updated, ${variantResult.totalAlready} already linked, ${variantResult.totalNotFound} not found`);
if (variantResult.notFoundSample.length) warn(`Not-found SKUs (sample): ${variantResult.notFoundSample.join(", ")}`);

section("Done.");
