#!/usr/bin/env node
/**
 * Verifies BSR fix by paginating all BSR products from Convex
 * and checking component counts per capacity.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").replace(/#.*$/, "").trim();
        if (key && value) process.env[key.trim()] = value;
    }
}

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Use the existing getProductPage action pattern via a dedicated check action
const result = await client.action(api.migrations.verifyBsrFix, {});
console.log("=== BSR FIX VERIFICATION ===\n");
console.log(JSON.stringify(result, null, 2));
