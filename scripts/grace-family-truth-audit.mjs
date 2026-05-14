#!/usr/bin/env node
/**
 * Audits Grace's family minimum-size guardrails against live Convex family data.
 *
 * This catches drift where prompt/config facts claim a family starts at one size
 * while productGroups already prove a different minimum.
 *
 * Usage:
 *   npm run test:grace:truth
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

try {
    const envPath = resolve(ROOT, ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch {
    /* optional */
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
    console.error("ERROR: NEXT_PUBLIC_CONVEX_URL not set.");
    process.exit(1);
}

function parseFamilyMinimums() {
    const source = readFileSync(resolve(ROOT, "convex/graceSearchUtils.ts"), "utf8");
    const match = source.match(/FAMILY_MIN_SIZE_ML:[^{]+{([\s\S]*?)};/);
    if (!match) throw new Error("Could not find FAMILY_MIN_SIZE_ML in convex/graceSearchUtils.ts");

    const minimums = new Map();
    for (const rawLine of match[1].split("\n")) {
        const line = rawLine.trim().replace(/,$/, "");
        if (!line) continue;
        const item = line.match(/^(?:"([^"]+)"|([A-Za-z ]+)):\s*(\d+(?:\.\d+)?)$/);
        if (!item) continue;
        minimums.set(item[1] ?? item[2].trim(), Number(item[3]));
    }
    return minimums;
}

async function main() {
    const client = new ConvexHttpClient(CONVEX_URL);
    const minimums = parseFamilyMinimums();
    const failures = [];
    const rows = [];

    for (const [family, expectedMin] of minimums.entries()) {
        const overview = await client.query(api.grace.getFamilyOverview, { family });
        const sizes = (overview.sizes ?? [])
            .map((size) => size.ml)
            .filter((ml) => typeof ml === "number")
            .sort((a, b) => a - b);
        const liveMin = sizes[0] ?? null;
        const ok = liveMin === expectedMin;
        rows.push({ family, expectedMin, liveMin, sizes });
        if (!ok) {
            failures.push(`${family}: guardrail=${expectedMin}ml, live=${liveMin ?? "none"}ml`);
        }
    }

    console.log(JSON.stringify({ deployment: CONVEX_URL, families: rows }, null, 2));

    if (failures.length > 0) {
        console.error("\nSTATUS: FAMILY TRUTH DRIFT DETECTED.");
        for (const failure of failures) console.error(`- ${failure}`);
        process.exit(1);
    }

    console.log("\nSTATUS: OK — Grace family minimum-size guardrails match live Convex family overview data.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
