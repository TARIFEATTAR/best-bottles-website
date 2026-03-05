#!/usr/bin/env node
/**
 * Seed Journal (blog) documents in Sanity from data/blog_posts_month1.json.
 * Creates 8 posts for Month 1 of the SEO content calendar.
 *
 * Usage:
 *   node scripts/seed_sanity_journal.mjs --dry-run   # preview
 *   node scripts/seed_sanity_journal.mjs             # create documents
 */
import { createClient } from "@sanity/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
    const envPath = resolve(ROOT, ".env.local");
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
    } catch {}
}

loadEnvLocal();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_STUDIO_DATASET || "production";

if (!projectId) {
    console.error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_STUDIO_PROJECT_ID");
    process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");

const sanity = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    useCdn: false,
    token: process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_TOKEN,
});

if (!(process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_TOKEN) && !isDryRun) {
    console.error("SANITY_API_WRITE_TOKEN or SANITY_API_TOKEN required for writes. Set in .env.local or use --dry-run.");
    process.exit(1);
}

function paragraphsToPortableText(paragraphs) {
    const blocks = [];
    for (let i = 0; i < paragraphs.length; i++) {
        blocks.push({
            _type: "block",
            _key: `p-${i}-${Math.random().toString(36).slice(2, 9)}`,
            style: "normal",
            markDefs: [],
            children: [
                {
                    _type: "span",
                    _key: `s-${i}-${Math.random().toString(36).slice(2, 9)}`,
                    text: paragraphs[i],
                    marks: [],
                },
            ],
        });
    }
    return blocks;
}

const dataPath = resolve(ROOT, "data", "blog_posts_month1.json");
const { posts } = JSON.parse(readFileSync(dataPath, "utf-8"));

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║  Best Bottles — Seed Journal Blog Posts (Month 1)    ║");
console.log("╚══════════════════════════════════════════════════════╝\n");
console.log(`  Posts: ${posts.length}`);
console.log(`  Dry run: ${isDryRun}\n`);

let created = 0;
for (const post of posts) {
    const doc = {
        _type: "journal",
        _id: `journal-${post.slug.replace(/[^a-z0-9-]/gi, "-")}`,
        title: post.title,
        slug: { _type: "slug", current: post.slug },
        category: post.category,
        publishedAt: post.publishedAt,
        estimatedReadTime: post.estimatedReadTime,
        excerpt: post.excerpt,
        content: paragraphsToPortableText(post.paragraphs),
        generationSource: "manual",
    };

    if (isDryRun) {
        console.log(`  Would create: ${post.slug}`);
        created++;
        continue;
    }

    try {
        await sanity.createOrReplace(doc);
        created++;
        console.log(`  ✓ ${post.slug}`);
    } catch (err) {
        console.error(`  ❌ ${post.slug}: ${err.message}`);
    }
}

console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║  Done                                               ║");
console.log("╚══════════════════════════════════════════════════════╝");
console.log(`\n  ✅ Created/updated: ${created}`);
console.log(`  ⚠️  Add hero images in Sanity Studio before publishing.\n`);
