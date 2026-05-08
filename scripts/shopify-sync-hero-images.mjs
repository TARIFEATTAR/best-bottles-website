#!/usr/bin/env node
/**
 * Push Convex productGroup.heroImageUrl onto Shopify product media.
 *
 * Match key: productGroups.slug === Shopify product handle.
 *
 * Usage:
 *   node scripts/shopify-sync-hero-images.mjs              # dry-run all eligible groups
 *   node scripts/shopify-sync-hero-images.mjs --limit 5    # first 5 eligible groups
 *   node scripts/shopify-sync-hero-images.mjs --apply --limit 5
 *   node scripts/shopify-sync-hero-images.mjs --apply --force      # add media even if product already has images
 *
 * Requires: NEXT_PUBLIC_CONVEX_URL, NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN
 * Scopes: read_products, write_products
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
    const envPath = resolve(__dirname, "..", ".env.local");
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
    } catch {
        /* optional */
    }
}

function parseArgs() {
    const apply = process.argv.includes("--apply");
    const dryRun = !apply;
    const force = process.argv.includes("--force");
    let limit = null;
    const li = process.argv.indexOf("--limit");
    if (li >= 0 && process.argv[li + 1]) {
        limit = parseInt(process.argv[li + 1], 10);
        if (Number.isNaN(limit)) limit = null;
    }
    return { dryRun, force, limit };
}

const PRODUCT_BY_HANDLE = `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      handle
      title
      media(first: 5) {
        edges { node { __typename } }
      }
    }
  }
`;

const CREATE_MEDIA = `
  mutation ProductCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media { ... on MediaImage { id } }
      mediaUserErrors { field message }
    }
  }
`;

async function adminGQL(domain, token, query, variables = {}) {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.errors?.length) {
        throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    return json.data;
}

function isHttpsUrl(s) {
    try {
        const u = new URL(s);
        return u.protocol === "https:";
    } catch {
        return false;
    }
}

async function main() {
    loadEnvLocal();
    const { dryRun, force, limit } = parseArgs();

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    if (!convexUrl || !domain || !token?.startsWith("shpat_")) {
        console.error(
            "Need NEXT_PUBLIC_CONVEX_URL, NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN (shpat_)",
        );
        process.exit(1);
    }

    const client = new ConvexHttpClient(convexUrl);
    const groups = await client.query(api.products.getAllCatalogGroups, {});

    let processed = 0;
    let skipped = 0;
    let added = 0;
    let errors = 0;

    for (const g of groups) {
        if (limit !== null && processed >= limit) break;

        const slug = g.slug;
        const hero = g.heroImageUrl;
        if (!slug || !hero || !isHttpsUrl(hero)) {
            skipped++;
            continue;
        }

        processed++;

        let data;
        try {
            data = await adminGQL(domain, token, PRODUCT_BY_HANDLE, { handle: slug });
        } catch (e) {
            console.error(`  �� ${slug}: query failed — ${e.message}`);
            errors++;
            continue;
        }

        const p = data.productByHandle;
        if (!p) {
            console.log(`  · ${slug}: no Shopify product with this handle (skip)`);
            skipped++;
            continue;
        }

        const hasMedia = (p.media?.edges?.length ?? 0) > 0;
        if (hasMedia && !force) {
            console.log(`  · ${slug}: already has media (use --force to add)`);
            skipped++;
            continue;
        }

        if (dryRun) {
            console.log(`  [dry-run] would add image → ${slug} (${p.id})`);
            continue;
        }

        try {
            const m = await adminGQL(domain, token, CREATE_MEDIA, {
                productId: p.id,
                media: [
                    {
                        mediaContentType: "IMAGE",
                        originalSource: hero,
                        alt: g.displayName ?? slug,
                    },
                ],
            });
            const errs = m.productCreateMedia.mediaUserErrors ?? [];
            if (errs.length) {
                console.error(`  x ${slug}:`, errs.map((e) => e.message).join("; "));
                errors++;
            } else {
                console.log(`  + ${slug}: media attached`);
                added++;
            }
        } catch (e) {
            console.error(`  x ${slug}: ${e.message}`);
            errors++;
        }

        await new Promise((r) => setTimeout(r, 250));
    }

    console.log("\n────────────────────────────────────────");
    console.log(
        `Done. groups scanned with hero URL: ${processed}, added: ${added}, skipped: ${skipped}, errors: ${errors}${dryRun ? " (dry-run)" : ""}`,
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
