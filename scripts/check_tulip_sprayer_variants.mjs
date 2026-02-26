#!/usr/bin/env node
/**
 * Check Tulip 5ml Amber and 6ml Clear Fine Mist Sprayer variants in Convex.
 * Verifies all 8 sprayer colors exist and whether capColor/trimColor are populated.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").replace(/#.*$/, "").trim();
        if (key && value) process.env[key.trim()] = value;
    }
}

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function main() {
    // Get tulip-5ml-amber and tulip-6ml-clear groups
    const slugs = ["tulip-5ml-amber", "tulip-6ml-clear"];
    for (const slug of slugs) {
        const data = await client.query(api.products.getProductGroup, { slug });
        if (!data) {
            console.log(`\n❌ No group for ${slug}`);
            continue;
        }
        const { group, variants } = data;
        const sprayerVariants = variants.filter((v) =>
            (v.applicator || "").toLowerCase().includes("fine mist") ||
            (v.applicator || "").toLowerCase().includes("sprayer")
        );
        console.log(`\n=== ${group.displayName} (${slug}) ===`);
        console.log(`Total variants: ${variants.length}`);
        console.log(`Fine Mist Sprayer variants: ${sprayerVariants.length}`);
        console.log("\nSprayer variants:");
        for (const v of sprayerVariants) {
            const capOk = v.capColor ? "✓" : "✗";
            const trimOk = v.trimColor ? "✓" : "✗";
            console.log(`  ${v.websiteSku} | capColor: ${v.capColor ?? "null"} ${capOk} | trimColor: ${v.trimColor ?? "null"} ${trimOk}`);
        }
        const withCapColor = sprayerVariants.filter((v) => v.capColor).length;
        console.log(`\nVariants with capColor populated: ${withCapColor}/${sprayerVariants.length}`);
    }
}

main().catch(console.error);
