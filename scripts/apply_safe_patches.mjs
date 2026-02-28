#!/usr/bin/env node
import { readFileSync } from "fs";
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
    // Optional when env is already loaded.
  }
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const out = {
    apply: false,
    regroup: false,
    planPath: resolve(__dirname, "..", "data", "audits", todayDate(), "reconcile_patch_plan.json"),
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") out.apply = true;
    else if (arg === "--regroup") out.regroup = true;
    else if (arg === "--plan" && argv[i + 1]) {
      out.planPath = resolve(process.cwd(), argv[i + 1]);
      i += 1;
    }
  }
  return out;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const args = parseArgs(process.argv);
const plan = JSON.parse(readFileSync(args.planPath, "utf-8"));
const patches = (plan.autoPatches || []).filter((patch) => patch?.websiteSku && patch?.set);

if (patches.length === 0) {
  console.log(`No auto patches found in ${args.planPath}`);
  process.exit(0);
}

console.log(`Loaded ${patches.length} auto patches from ${args.planPath}`);

if (!args.apply) {
  console.log("Dry run only. Use --apply to patch Convex.");
  console.log("Example patch:", JSON.stringify(patches[0], null, 2));
  process.exit(0);
}

loadEnvLocal();
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in environment or .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);
let totalUpdated = 0;
let totalMissing = 0;
let totalSkipped = 0;
let batchNo = 1;

for (const batch of chunk(patches, 50)) {
  const result = await client.mutation(api.migrations.applySafeWebsiteSkuPatches, {
    patches: batch,
  });
  totalUpdated += result.updatedCount ?? 0;
  totalMissing += result.missingSkus?.length ?? 0;
  totalSkipped += result.skippedCount ?? 0;
  console.log(
    `Batch ${batchNo}: updated=${result.updatedCount ?? 0} missing=${result.missingSkus?.length ?? 0} skipped=${result.skippedCount ?? 0}`
  );
  batchNo += 1;
}

console.log(`Patch apply complete. updated=${totalUpdated} missing=${totalMissing} skipped=${totalSkipped}`);

if (args.regroup) {
  console.log("Rebuilding product groups...");
  await client.mutation(api.migrations.clearProductGroupLinks, {});
  await client.action(api.migrations.buildProductGroups, {});
  await client.action(api.migrations.linkProductsToGroups, {});
  console.log("Regroup complete.");
}
