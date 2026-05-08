#!/usr/bin/env node
/**
 * Fix the 3 null-price SKUs flagged during catalog push.
 *
 * Prices were inferred from same-family, same-applicator siblings — every
 * Boston Round 30ml MRL = $1.07 / $1.02, every Boston Round 30ml RBL = $0.92 / $0.87.
 *
 *   - Updates Shopify variant prices (immediate, unblocks checkout)
 *   - Prints the `npx convex run` command to patch Convex source-of-truth
 *     (patchProductFields is internalMutation, so must run via Convex CLI)
 *
 * Usage:
 *   node scripts/fix_null_prices.mjs --dry-run  # print plan only (default)
 *   node scripts/fix_null_prices.mjs --apply    # actually update Shopify
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

try {
    const envPath = resolve(ROOT, ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch { /* ok */ }

const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", B = "\x1b[1m", X = "\x1b[0m";
const ok = (s) => console.log(`${G}✓${X} ${s}`);
const fail = (s) => console.log(`${R}✗${X} ${s}`);
const info = (s) => console.log(`${D}  ${s}${X}`);
const section = (s) => console.log(`\n${B}${s}${X}`);

const apply = process.argv.includes("--apply");

const missingEnv = ["NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN"].filter((key) => !process.env[key]);
if (apply && missingEnv.length) {
    fail(`Missing env for --apply: ${missingEnv.join(", ")}`);
    process.exit(1);
}

const SHOPIFY_DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2025-01";

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

const FIXES = [
    { graceSku: "GB-BSR-AMB-30ML-MRL-SBLK", convexId: "kd7car3thens87vdz186asfhf981vj30", price: "1.07", price12pc: 1.02 },
    { graceSku: "GB-BSR-AMB-30ML-RBL-SBLK", convexId: "kd701sng11wk3n2zcydfhebwah81tmw0", price: "0.92", price12pc: 0.87 },
    { graceSku: "GB-BSR-CBL-30ML-RBL-SBLK", convexId: "kd7brzfg8njdjng3sn40wzw6sd81tkd7", price: "0.92", price12pc: 0.87 },
];

section(`Fix null-price SKUs — ${apply ? `${R}APPLY${X}` : `${G}DRY-RUN${X}`}`);

section("1. Shopify variant updates");

if (!apply) {
    for (const fix of FIXES) {
        info(`${fix.graceSku} → target=$${fix.price}`);
    }
    info("");
    info(`Dry-run complete. Add ${B}--apply${X} to look up and update Shopify variants.`);
} else {
    for (const fix of FIXES) {
        const lookup = await shopify(
            `query($q: String!) {
                productVariants(first: 1, query: $q) {
                    edges { node { id sku price product { id handle } } }
                }
            }`,
            { q: `sku:${fix.graceSku}` },
        );
        const node = lookup.productVariants.edges[0]?.node;
        if (!node) {
            fail(`${fix.graceSku} — not found in Shopify`);
            continue;
        }
        info(`${fix.graceSku} · handle=${node.product.handle} · current=$${node.price} → target=$${fix.price}`);

        const upd = await shopify(
            `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                    productVariants { id sku price }
                    userErrors { field message }
                }
            }`,
            {
                productId: node.product.id,
                variants: [{ id: node.id, price: fix.price }],
            },
        );
        const errs = upd.productVariantsBulkUpdate.userErrors ?? [];
        if (errs.length) {
            fail(`  ${fix.graceSku} — ${errs.map((e) => e.message).join("; ")}`);
        } else {
            const updated = upd.productVariantsBulkUpdate.productVariants[0];
            ok(`  ${fix.graceSku} — updated to $${updated.price}`);
        }
    }
}

section("2. Convex source-of-truth update (run manually)");
info(`patchProductFields is internalMutation — run this from your terminal:`);
console.log("");
const patches = FIXES.map((f) =>
    `    {"id":"${f.convexId}","fields":{"webPrice1pc":${Number(f.price)},"webPrice12pc":${f.price12pc}}}`,
).join(",\n");
console.log(`${B}npx convex run migrations:patchProductFields '{"patches":[${X}`);
console.log(patches);
console.log(`${B}]}'${X}`);
console.log("");
info(`Convex CLI uses your deploy key, so it can call internalMutation directly.`);
