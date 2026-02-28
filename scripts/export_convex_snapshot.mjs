#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    // Optional when env vars already exist.
  }
}

function getTodayFolder() {
  return new Date().toISOString().slice(0, 10);
}

loadEnvLocal();

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in environment or .env.local");
  process.exit(1);
}

const targetDate = process.argv[2] || getTodayFolder();
const outDir = resolve(__dirname, "..", "data", "audits", targetDate);
const outFile = resolve(outDir, "convex_snapshot.json");

mkdirSync(outDir, { recursive: true });

const client = new ConvexHttpClient(convexUrl);
const products = [];
let cursor = null;
let pageCount = 0;

while (true) {
  const page = await client.action(api.products.getProductExportPage, {
    cursor,
    numItems: 250,
  });
  products.push(...page.page);
  pageCount += 1;
  console.log(`Fetched page ${pageCount}: +${page.page.length} (total ${products.length})`);
  if (page.isDone) break;
  cursor = page.continueCursor;
}

writeFileSync(
  outFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: products.length,
      products,
    },
    null,
    2
  )
);

console.log(`Saved Convex snapshot: ${outFile}`);
