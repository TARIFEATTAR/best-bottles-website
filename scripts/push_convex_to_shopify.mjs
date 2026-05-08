#!/usr/bin/env node
/**
 * Push Convex catalog → Shopify Plus.
 *
 * One Shopify product per Convex productGroup; each Convex product in the
 * group becomes a Shopify variant keyed on `graceSku` (matches the path
 * /api/shopify/resolve-variants uses).
 *
 * v1 scope (deliberately minimal — goal: make checkout work, not perfect UX):
 *   - Options: single "SKU" option with graceSku as value per variant
 *     (Shopify requires ≥ 1 option for multi-variant products)
 *   - Price: webPrice1pc, falling back to $0.01 placeholder with warning
 *   - Inventory: NOT tracked (tracked:false) — can enable later per-variant
 *   - Status: DRAFT (won't appear on storefront until you promote it)
 *   - Images: SKIPPED — add later once image URLs are verified
 *
 * Idempotency:
 *   - Before writing, we query Shopify for an existing product with the same
 *     handle. If found, the default mode updates it through productSet by
 *     passing its product GID in the input. Re-run is safe.
 *   - Use --skip-existing for create-only rehearsals.
 *   - Every run writes a manifest with created/updated/skipped/failed rows so
 *     failures are actionable by product group slug and SKU.
 *
 * Usage:
 *   node scripts/push_convex_to_shopify.mjs                          # dry-run (default)
 *   node scripts/push_convex_to_shopify.mjs --validate-only           # Convex-only SKU/price/variant-count audit
 *   node scripts/push_convex_to_shopify.mjs --limit 3                # dry-run, 3 groups
 *   node scripts/push_convex_to_shopify.mjs --family Cylinder        # dry-run, one family
 *   node scripts/push_convex_to_shopify.mjs --slug atomizer-5ml      # dry-run, one group
 *   node scripts/push_convex_to_shopify.mjs --apply --limit 3        # push 3 groups
 *   node scripts/push_convex_to_shopify.mjs --apply                  # push EVERYTHING
 *   node scripts/push_convex_to_shopify.mjs --apply --status ACTIVE  # push live (default DRAFT)
 *   node scripts/push_convex_to_shopify.mjs --apply --allow-placeholder-prices
 *   node scripts/push_convex_to_shopify.mjs --apply --skip-existing  # create only
 *   node scripts/push_convex_to_shopify.mjs --manifest tmp/run.json   # custom manifest path
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
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
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch { /* ok */ }

// ── Args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`
Convex → Shopify catalog sync

Usage:
  node scripts/push_convex_to_shopify.mjs [options]

Options:
  --validate-only              Audit Convex mapping only; does not require Shopify env vars
  --apply                      Write to Shopify. Without this, the script is a dry run
  --allow-placeholder-prices   Allow missing prices to sync as $0.01 during --apply
  --skip-existing              In apply mode, skip products whose Shopify handle already exists
  --family <name>              Limit to one Convex family
  --slug <slug>                Limit to one product group slug
  --limit <n>                  Limit number of product groups
  --status <DRAFT|ACTIVE|ARCHIVED>
  --manifest <path>            Write manifest JSON to this path
`);
    process.exit(0);
}

function argVal(name) {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const value = argv[i + 1];
    return value && !value.startsWith("--") ? value : undefined;
}

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const args = {
    apply: argv.includes("--apply"),
    validateOnly: argv.includes("--validate-only"),
    allowPlaceholderPrices: argv.includes("--allow-placeholder-prices"),
    skipExisting: argv.includes("--skip-existing"),
    limit: Number(argVal("--limit")) || undefined,
    family: argVal("--family"),
    slug: argVal("--slug"),
    status: argVal("--status") ?? "DRAFT",
    manifestPath: argVal("--manifest") ?? resolve(ROOT, "tmp", "shopify-sync", `manifest-${runId}.json`),
};

const VALID_STATUSES = new Set(["ACTIVE", "ARCHIVED", "DRAFT"]);
args.status = args.status.toUpperCase();
if (!VALID_STATUSES.has(args.status)) {
    throw new Error(`Invalid --status "${args.status}". Expected ACTIVE, ARCHIVED, or DRAFT.`);
}
if (args.validateOnly && args.apply) {
    throw new Error("--validate-only cannot be combined with --apply.");
}

// ── Pretty output ────────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", B = "\x1b[1m", C = "\x1b[36m", X = "\x1b[0m";
const ok = (s) => console.log(`${G}✓${X} ${s}`);
const fail = (s) => console.log(`${R}✗${X} ${s}`);
const info = (s) => console.log(`${D}  ${s}${X}`);
const warn = (s) => console.log(`${Y}⚠${X} ${s}`);
const section = (s) => console.log(`\n${B}${s}${X}`);

// ── Env check ────────────────────────────────────────────────────────────────
const REQ = args.validateOnly
    ? ["NEXT_PUBLIC_CONVEX_URL"]
    : ["NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN", "NEXT_PUBLIC_CONVEX_URL"];
const missing = REQ.filter((k) => !process.env[k]);
if (missing.length) { fail(`Missing env: ${missing.join(", ")}`); process.exit(1); }

const SHOPIFY_DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2025-01";
const MAX_SHOPIFY_VARIANTS_PER_PRODUCT = 100;

// ── Shopify helper ───────────────────────────────────────────────────────────
async function shopify(query, variables) {
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_TOKEN },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) throw new Error(`GQL: ${json.errors.map((e) => e.message).join("; ")}`);
    return json.data;
}

// Soft rate-limiter — target ~1 request per second to stay well under Plus quota.
async function paced(fn) {
    const t0 = Date.now();
    const result = await fn();
    const elapsed = Date.now() - t0;
    if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
    return result;
}

// ── Mapping: Convex productGroup + variants → Shopify productSet input ───────
function buildProductSetInput(group, variants, status) {
    const priceIssues = [];
    const missingSkuVariants = [];
    const variantKeyCounts = new Map();
    const shopifyVariants = variants.map((v) => {
        const variantKey = v.graceSku || v.websiteSku;
        const priceNum = v.webPrice1pc ?? null;
        if (priceNum == null) priceIssues.push(variantKey);
        if (!variantKey) missingSkuVariants.push(v._id ?? v.id ?? v.name ?? "(unknown variant)");
        const price = (priceNum ?? 0.01).toFixed(2);
        variantKeyCounts.set(variantKey, (variantKeyCounts.get(variantKey) ?? 0) + 1);
        return {
            sku: variantKey,
            price,
            optionValues: [{ optionName: "SKU", name: variantKey }],
            inventoryItem: { tracked: false },
        };
    });

    const tags = [
        group.family,
        group.color,
        group.bottleCollection,
        group.category,
    ].filter(Boolean);

    return {
        input: {
            handle: group.slug,
            title: group.displayName,
            descriptionHtml: group.groupDescription ?? "",
            productType: group.family ?? "",
            vendor: "Best Bottles",
            tags,
            status,
            productOptions: [
                {
                    name: "SKU",
                    values: shopifyVariants.map((v) => ({ name: v.sku })),
                },
            ],
            variants: shopifyVariants,
        },
        priceIssues,
        missingSkuVariants,
        duplicateSkus: [...variantKeyCounts.entries()]
            .filter(([sku, count]) => sku && count > 1)
            .map(([sku]) => sku),
    };
}

function manifestVariant(v) {
    return {
        productId: v.productId ?? null,
        graceSku: v.graceSku ?? null,
        websiteSku: v.websiteSku ?? null,
        shopifyVariantId: v.shopifyVariantId ?? null,
        shopifyInventoryItemId: v.shopifyInventoryItemId ?? null,
        price: v.webPrice1pc ?? null,
        itemName: v.itemName ?? null,
    };
}

function variantSku(v) {
    return v.graceSku ?? v.websiteSku ?? null;
}

function buildManifest() {
    return {
        runId,
        generatedAt: new Date().toISOString(),
        mode: args.validateOnly ? "validate-only" : args.apply ? "apply" : "dry-run",
        syncMode: args.validateOnly ? "convex-contract-validation" : args.skipExisting ? "create-only" : "upsert",
        storeDomain: SHOPIFY_DOMAIN,
        filters: {
            family: args.family ?? null,
            slug: args.slug ?? null,
            limit: args.limit ?? null,
            status: args.status,
        },
        summary: {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            totalVariants: 0,
            priceIssueCount: 0,
            missingSkuCount: 0,
            duplicateSkuCount: 0,
        },
        rows: [],
    };
}

function recordRow(manifest, row) {
    manifest.rows.push({
        timestamp: new Date().toISOString(),
        ...row,
    });
}

function writeManifest(manifest) {
    mkdirSync(dirname(args.manifestPath), { recursive: true });
    writeFileSync(args.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

// ── Main ────────────────────────────────────────────────────────────────────
section("Push Convex → Shopify");
info(`Mode: ${args.validateOnly ? `${G}VALIDATE ONLY${X}` : args.apply ? `${R}APPLY${X}` : `${G}DRY-RUN${X}`}`);
info(`Status: ${args.status}`);
info(`Sync mode: ${args.validateOnly ? "Convex contract validation" : args.skipExisting ? "create-only (skip existing handles)" : "upsert (update existing handles)"}`);
if (args.apply && !args.allowPlaceholderPrices) {
    info("Price policy: missing prices block apply. Pass --allow-placeholder-prices to use $0.01 placeholders.");
}
info(`Manifest: ${args.manifestPath}`);
if (args.limit) info(`Limit: ${args.limit} groups`);
if (args.family) info(`Family filter: ${args.family}`);
if (args.slug) info(`Slug filter: ${args.slug}`);

const manifest = buildManifest();

// Load Convex
const { ConvexHttpClient } = await import("convex/browser");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Step 1. Fetch all groups
section("1. Fetching Convex groups");
let groups = await convex.query("products:getAllCatalogGroups", {});
ok(`Loaded ${groups.length} groups`);

if (args.family) {
    groups = groups.filter((g) => g.family?.toLowerCase() === args.family.toLowerCase());
    info(`After family filter: ${groups.length}`);
}
if (args.slug) {
    groups = groups.filter((g) => g.slug === args.slug);
    info(`After slug filter: ${groups.length}`);
}
if (args.limit) {
    groups = groups.slice(0, args.limit);
    info(`After limit: ${groups.length}`);
}

if (groups.length === 0) {
    warn("No groups to process.");
    writeManifest(manifest);
    ok(`Manifest written: ${args.manifestPath}`);
    process.exit(0);
}

// Step 2. Plan / apply
section(`2. ${args.apply ? "Applying" : "Planning"}`);

const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    totalVariants: 0,
    priceIssues: [],
    missingSkuVariants: [],
    duplicateSkus: [],
};

for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const idx = `[${i + 1}/${groups.length}]`;

    // Fetch variants for this group
    let variants;
    try {
        variants = await convex.query("products:getVariantsForGroup", { groupId: g._id });
    } catch (err) {
        fail(`${idx} ${g.slug} — failed to load variants: ${err.message}`);
        summary.failed++;
        continue;
    }

    if (!variants || variants.length === 0) {
        warn(`${idx} ${g.slug} — 0 variants, skipping`);
        summary.skipped++;
        recordRow(manifest, {
            slug: g.slug,
            displayName: g.displayName,
            status: "skipped",
            reason: "no_variants",
            variantCount: 0,
        });
        continue;
    }

    if (variants.length > MAX_SHOPIFY_VARIANTS_PER_PRODUCT) {
        warn(`${idx} ${g.slug} — ${variants.length} variants exceeds Shopify productSet limit of ${MAX_SHOPIFY_VARIANTS_PER_PRODUCT}`);
        summary.failed++;
        recordRow(manifest, {
            slug: g.slug,
            displayName: g.displayName,
            status: "failed",
            operation: args.validateOnly ? "validate" : "plan",
            reason: "too_many_variants",
            maxVariants: MAX_SHOPIFY_VARIANTS_PER_PRODUCT,
            variantCount: variants.length,
            variants: variants.map(manifestVariant),
        });
        continue;
    }

    // Check for existing product by handle unless this is a Convex-only validation run.
    let existing = null;
    if (!args.validateOnly) {
        try {
            const existsData = await shopify(
                `query($handle: String!) { productByHandle(handle: $handle) { id handle } }`,
                { handle: g.slug },
            );
            existing = existsData.productByHandle;
        } catch (err) {
            warn(`${idx} ${g.slug} — handle check failed (${err.message.slice(0, 80)}), proceeding anyway`);
        }
    }

    if (existing) {
        const reason = args.skipExisting ? "existing_product_create_only" : null;
        if (!reason) {
            // Continue below and use productSet with input.id for an idempotent update.
        } else {
            info(`${idx} ${C}${g.slug}${X} — ${Y}already exists${X} (${existing.id}), skipping — ${variants.length} variants`);
            summary.skipped++;
            recordRow(manifest, {
                slug: g.slug,
                displayName: g.displayName,
                status: "skipped",
                reason,
                shopifyProductId: existing.id,
                variantCount: variants.length,
                skus: variants.map(variantSku).filter(Boolean),
                variants: variants.map(manifestVariant),
            });
            continue;
        }
    }

    const operation = args.validateOnly ? "validate" : existing ? "update" : "create";

    // Build input
    const { input, priceIssues, missingSkuVariants, duplicateSkus } = buildProductSetInput(g, variants, args.status);
    if (existing) {
        input.id = existing.id;
    }
    summary.totalVariants += variants.length;
    summary.priceIssues.push(...priceIssues);
    summary.missingSkuVariants.push(...missingSkuVariants);
    summary.duplicateSkus.push(...duplicateSkus);

    if (missingSkuVariants.length) {
        warn(`${idx} ${g.slug} — variants missing graceSku/websiteSku: ${missingSkuVariants.slice(0, 5).join(", ")}`);
        summary.failed++;
        recordRow(manifest, {
            slug: g.slug,
            displayName: g.displayName,
            status: "failed",
            operation,
            reason: "missing_skus",
            missingSkuVariants,
            variantCount: variants.length,
            variants: variants.map(manifestVariant),
        });
        continue;
    }

    if (duplicateSkus.length) {
        warn(`${idx} ${g.slug} — duplicate SKU values in Convex variants: ${duplicateSkus.slice(0, 5).join(", ")}`);
        summary.failed++;
        recordRow(manifest, {
            slug: g.slug,
            displayName: g.displayName,
            status: "failed",
            operation,
            reason: "duplicate_skus",
            duplicateSkus,
            variantCount: variants.length,
            variants: variants.map(manifestVariant),
        });
        continue;
    }

    if (args.apply && priceIssues.length && !args.allowPlaceholderPrices) {
        warn(`${idx} ${g.slug} — ${priceIssues.length} missing prices; blocked before Shopify write`);
        summary.failed++;
        recordRow(manifest, {
            slug: g.slug,
            displayName: g.displayName,
            status: "failed",
            operation,
            reason: "missing_prices",
            priceIssueSkus: priceIssues,
            variantCount: variants.length,
            variants: variants.map(manifestVariant),
        });
        continue;
    }

    if (!args.apply) {
        const action = args.validateOnly ? "validated" : operation === "update" ? "would update" : "would create";
        info(`${idx} ${C}${g.slug}${X} — ${action} · ${variants.length} variants · prices ${priceIssues.length ? `(${priceIssues.length} missing)` : "ok"}`);
        if (args.validateOnly) summary.skipped++;
        else if (operation === "update") summary.updated++;
        else summary.created++;
        recordRow(manifest, {
            slug: g.slug,
            displayName: g.displayName,
            status: args.validateOnly ? "validated" : `planned_${operation}`,
            operation,
            shopifyProductId: existing?.id ?? null,
            variantCount: variants.length,
            priceIssueSkus: priceIssues,
            skus: variants.map(variantSku).filter(Boolean),
            variants: variants.map(manifestVariant),
        });
        continue;
    }

    // Apply: create or update product
    try {
        const result = await paced(() =>
            shopify(
                `mutation productSet($input: ProductSetInput!) {
                    productSet(synchronous: true, input: $input) {
                        product {
                            id
                            handle
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
                        userErrors { field message }
                    }
                }`,
                { input },
            ),
        );
        const errs = result.productSet.userErrors ?? [];
        if (errs.length) {
            fail(`${idx} ${g.slug} — ${errs.length} error(s):`);
            for (const e of errs) info(`    ${e.field?.join(".") ?? ""}: ${e.message}`);
            summary.failed++;
            recordRow(manifest, {
                slug: g.slug,
                displayName: g.displayName,
                status: "failed",
                operation,
                reason: "shopify_user_errors",
                errors: errs,
                variantCount: variants.length,
            });
            continue;
        }
        const prod = result.productSet.product;
        const syncedVariants = (prod?.variants?.edges ?? []).map(({ node }) => ({
            sku: node.sku,
            shopifyVariantId: node.id,
            shopifyInventoryItemId: node.inventoryItem?.id ?? null,
        }));
        if (operation === "update") {
            ok(`${idx} ${C}${g.slug}${X} — updated ${prod.id} · ${syncedVariants.length} variants`);
            summary.updated++;
        } else {
            ok(`${idx} ${C}${g.slug}${X} — created ${prod.id} · ${syncedVariants.length} variants`);
            summary.created++;
        }
        recordRow(manifest, {
            slug: g.slug,
            displayName: g.displayName,
            status: operation === "update" ? "updated" : "created",
            operation,
            shopifyProductId: prod.id,
            shopifyHandle: prod.handle,
            variantCount: variants.length,
            priceIssueSkus: priceIssues,
            variants: syncedVariants,
        });
    } catch (err) {
        fail(`${idx} ${g.slug} — ${err.message.slice(0, 200)}`);
        summary.failed++;
        recordRow(manifest, {
            slug: g.slug,
            displayName: g.displayName,
            status: "failed",
            operation,
            reason: "exception",
            error: err.message,
            variantCount: variants.length,
        });
    }
}

// Step 3. Summary
section("Summary");
ok(`${args.apply ? "Created" : "Would create"}: ${summary.created} products`);
ok(`${args.apply ? "Updated" : "Would update"}: ${summary.updated} products`);
info(`Variants processed: ${summary.totalVariants}`);
if (summary.skipped) info(`Skipped/validated: ${summary.skipped}`);
if (summary.failed) fail(`Failed: ${summary.failed}`);
if (summary.priceIssues.length) {
    const priceMessage = args.apply && args.allowPlaceholderPrices
        ? "filled with $0.01 placeholder"
        : "would block --apply unless fixed or --allow-placeholder-prices is passed";
    warn(`${summary.priceIssues.length} variants had null price — ${priceMessage}:`);
    for (const sku of summary.priceIssues.slice(0, 10)) info(`  ${sku}`);
    if (summary.priceIssues.length > 10) info(`  ...and ${summary.priceIssues.length - 10} more`);
}
if (summary.missingSkuVariants.length) {
    warn(`${summary.missingSkuVariants.length} variants missing graceSku/websiteSku blocked sync:`);
    for (const variant of summary.missingSkuVariants.slice(0, 10)) info(`  ${variant}`);
    if (summary.missingSkuVariants.length > 10) info(`  ...and ${summary.missingSkuVariants.length - 10} more`);
}
if (summary.duplicateSkus.length) {
    warn(`${summary.duplicateSkus.length} duplicate SKU values blocked sync:`);
    for (const sku of summary.duplicateSkus.slice(0, 10)) info(`  ${sku}`);
    if (summary.duplicateSkus.length > 10) info(`  ...and ${summary.duplicateSkus.length - 10} more`);
}

manifest.summary = {
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    failed: summary.failed,
    totalVariants: summary.totalVariants,
    priceIssueCount: summary.priceIssues.length,
    missingSkuCount: summary.missingSkuVariants.length,
    duplicateSkuCount: summary.duplicateSkus.length,
};
writeManifest(manifest);
ok(`Manifest written: ${args.manifestPath}`);

if (!args.apply) {
    info("");
    info(`${args.validateOnly ? "Validation" : "Dry-run"} complete. To actually push/upsert: add ${B}--apply${X}`);
}
