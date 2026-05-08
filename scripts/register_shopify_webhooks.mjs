#!/usr/bin/env node
/**
 * Register the four webhooks our site expects in Shopify.
 *
 * Idempotent: queries existing subscriptions first, only creates missing ones,
 * and (optionally, with --update-url) rewrites the callbackUrl on any stale ones.
 *
 * Usage:
 *   node scripts/register_shopify_webhooks.mjs --url https://bestbottles.vercel.app             # dry-run
 *   node scripts/register_shopify_webhooks.mjs --url https://bestbottles.vercel.app --apply     # create
 *   node scripts/register_shopify_webhooks.mjs --url https://www.bestbottles.com --apply --update-url
 *   node scripts/register_shopify_webhooks.mjs --list                                           # just show what's registered
 *
 * The webhook endpoint path is always /api/shopify/webhooks.
 * The endpoint verifies HMAC via SHOPIFY_WEBHOOK_SECRET — that secret must
 * match the one Shopify uses to sign, which is the custom app's API secret key.
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
const warn = (s) => console.log(`${Y}⚠${X} ${s}`);
const section = (s) => console.log(`\n${B}${s}${X}`);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
};

const listOnly = flag("list");
const apply = flag("apply");
const updateUrl = flag("update-url");
const baseUrl = arg("url");

if (!listOnly && !baseUrl) {
    fail(`Missing required --url <base>. Example: --url https://bestbottles.vercel.app`);
    process.exit(1);
}
const CALLBACK_URL = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/shopify/webhooks` : null;

const TOPICS = [
    "PRODUCTS_CREATE",
    "PRODUCTS_UPDATE",
    "PRODUCTS_DELETE",
    "INVENTORY_LEVELS_UPDATE",
];

const missingEnv = ["NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN"].filter((key) => !process.env[key]);
if (missingEnv.length) {
    fail(`Missing env: ${missingEnv.join(", ")}`);
    process.exit(1);
}

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
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) throw new Error(`GQL: ${json.errors.map((e) => e.message).join("; ")}`);
    return json.data;
}

section("Shopify webhook registration");
info(`Store: ${SHOPIFY_DOMAIN}`);
if (CALLBACK_URL) info(`Callback: ${CALLBACK_URL}`);
info(`Mode: ${listOnly ? "LIST" : apply ? `${R}APPLY${X}` : `${G}DRY-RUN${X}`}`);

// Fetch existing subscriptions
const existing = await shopify(`{
    webhookSubscriptions(first: 50) {
        edges {
            node {
                id
                topic
                format
                endpoint {
                    __typename
                    ... on WebhookHttpEndpoint { callbackUrl }
                }
            }
        }
    }
}`);

section("Current subscriptions");
const subs = existing.webhookSubscriptions.edges.map((e) => e.node);
if (subs.length === 0) {
    info(`(none registered)`);
} else {
    for (const s of subs) {
        const url = s.endpoint?.callbackUrl ?? `(${s.endpoint?.__typename})`;
        info(`${s.topic.padEnd(30)} ${s.format.padEnd(6)} → ${url}`);
    }
}

if (listOnly) process.exit(0);

// Plan: for each desired topic, decide create / update / skip
section("Plan");
const plan = [];
for (const topic of TOPICS) {
    const match = subs.find((s) => s.topic === topic);
    if (!match) {
        plan.push({ action: "create", topic });
        info(`${topic.padEnd(30)} → ${G}create${X}`);
    } else if (match.endpoint?.callbackUrl !== CALLBACK_URL) {
        if (updateUrl) {
            plan.push({ action: "update", topic, id: match.id, from: match.endpoint?.callbackUrl });
            info(`${topic.padEnd(30)} → ${Y}update${X} (was: ${match.endpoint?.callbackUrl})`);
        } else {
            plan.push({ action: "skip-stale", topic, id: match.id, from: match.endpoint?.callbackUrl });
            warn(`${topic.padEnd(30)} → exists with stale URL ${match.endpoint?.callbackUrl} — pass --update-url to rewrite`);
        }
    } else {
        info(`${topic.padEnd(30)} → ${D}already correct${X}`);
    }
}

if (!apply) {
    info("");
    info(`Dry-run. Add ${B}--apply${X} to execute.`);
    process.exit(0);
}

// Apply
section("Applying");
for (const step of plan) {
    if (step.action === "create") {
        const res = await shopify(
            `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
                webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
                    webhookSubscription { id topic }
                    userErrors { message }
                }
            }`,
            {
                topic: step.topic,
                sub: { callbackUrl: CALLBACK_URL, format: "JSON" },
            },
        );
        const errs = res.webhookSubscriptionCreate.userErrors ?? [];
        if (errs.length) fail(`${step.topic} — ${errs.map((e) => e.message).join("; ")}`);
        else ok(`${step.topic} — created`);
    } else if (step.action === "update") {
        const res = await shopify(
            `mutation($id: ID!, $sub: WebhookSubscriptionInput!) {
                webhookSubscriptionUpdate(id: $id, webhookSubscription: $sub) {
                    webhookSubscription { id topic }
                    userErrors { message }
                }
            }`,
            {
                id: step.id,
                sub: { callbackUrl: CALLBACK_URL, format: "JSON" },
            },
        );
        const errs = res.webhookSubscriptionUpdate.userErrors ?? [];
        if (errs.length) fail(`${step.topic} — ${errs.map((e) => e.message).join("; ")}`);
        else ok(`${step.topic} — updated → ${CALLBACK_URL}`);
    }
}

section("Done");
info(`Shopify will deliver events to ${CALLBACK_URL}.`);
info(`Your site must have SHOPIFY_WEBHOOK_SECRET set matching the custom app's API secret key,`);
info(`otherwise HMAC verification in src/app/api/shopify/webhooks/route.ts:26 rejects all incoming calls.`);
