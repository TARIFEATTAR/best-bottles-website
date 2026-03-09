#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const DEFAULT_REPORT = path.join(ROOT, "data", "grace-evals", "latest-results.json");
const reportPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_REPORT;

function percent(value, total) {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

async function main() {
  const payload = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const rows = payload.rows ?? [];
  const promptCount = payload.summary?.promptCount ?? rows.length;
  const failing = rows.filter((row) => !row.metrics?.pass);
  const wrongFamily = rows.filter(
    (row) =>
      row.expectedTopKFamilies?.length &&
      row.result?.bestGroup &&
      !row.expectedTopKFamilies.includes(row.result.bestGroup.family)
  );

  console.log("Grace Retrieval Eval Report");
  console.log(`Report: ${reportPath}`);
  console.log(`Prompts: ${promptCount}`);
  console.log(`Overall pass rate: ${payload.summary.passCount}/${promptCount} (${percent(payload.summary.passCount, promptCount)})`);
  console.log(`Top-1 family accuracy: ${payload.summary.top1FamilyAccuracy}/${promptCount} (${percent(payload.summary.top1FamilyAccuracy, promptCount)})`);
  console.log(`Top-3 family recall: ${payload.summary.top3FamilyRecall}/${promptCount} (${percent(payload.summary.top3FamilyRecall, promptCount)})`);
  console.log(`Exact slug hits: ${payload.summary.exactSlugHits}`);
  console.log(`Wrong-family regressions: ${payload.summary.wrongFamilyCount}`);

  if (failing.length > 0) {
    console.log("\nFailing prompts:");
    for (const row of failing) {
      console.log(`- ${row.id}: ${row.prompt}`);
      console.log(`  expected families: ${(row.expectedTopKFamilies ?? []).join(", ") || "n/a"}`);
      console.log(`  got: ${row.result?.bestGroup?.family ?? "no match"} (${row.result?.bestGroup?.slug ?? "n/a"})`);
      console.log(`  mode: ${row.result?.resolutionMode ?? "n/a"}`);
    }
  }

  if (wrongFamily.length > 0) {
    console.log("\nWrong-family regressions:");
    for (const row of wrongFamily) {
      console.log(`- ${row.id}: expected ${(row.expectedTopKFamilies ?? []).join(", ")}, got ${row.result.bestGroup.family}`);
    }
  }
}

await main();
