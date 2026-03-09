#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ConvexHttpClient } from "convex/browser";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const PROMPTS_PATH = path.join(ROOT, "data", "grace-evals", "prompts.json");
const DEFAULT_OUT = path.join(ROOT, "data", "grace-evals", "latest-results.json");

function getFlag(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const CONVEX_URL = getFlag("convexUrl", process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL);
if (!CONVEX_URL) {
  console.error("Missing Convex URL. Pass --convexUrl=... or set NEXT_PUBLIC_CONVEX_URL.");
  process.exit(1);
}

const OUT_PATH = getFlag("out", DEFAULT_OUT);
const PRINT_JSON = process.argv.includes("--json");

function scorePrompt(prompt, result) {
  const topGroup = result.groups?.[0] ?? null;
  const top3Groups = result.groups?.slice(0, 3) ?? [];
  const expectedFamilies = new Set(prompt.expectedTopKFamilies ?? []);
  const topFamily = topGroup?.family ?? null;
  const topSlug = topGroup?.slug ?? null;

  const topSlugMatch = prompt.expectedTopSlug ? topSlug === prompt.expectedTopSlug : null;
  const top1FamilyMatch = expectedFamilies.size > 0 ? expectedFamilies.has(topFamily) : null;
  const top3FamilyHit =
    expectedFamilies.size > 0
      ? top3Groups.some((group) => expectedFamilies.has(group.family))
      : null;
  const resolutionModeMatch = prompt.expectedResolutionMode
    ? result.resolutionMode === prompt.expectedResolutionMode
    : null;
  const familyPassMetric =
    prompt.passMetric ??
    (prompt.expectedResolutionMode === "ranked_groups" && expectedFamilies.size > 1
      ? "top3FamilyHit"
      : "top1FamilyMatch");

  const pass =
    (topSlugMatch ??
      (familyPassMetric === "top3FamilyHit" ? top3FamilyHit : top1FamilyMatch) ??
      top3FamilyHit ??
      true) &&
    (resolutionModeMatch ?? true);

  return {
    id: prompt.id,
    prompt: prompt.prompt,
    expectedTool: prompt.expectedTool ?? null,
    expectedTopSlug: prompt.expectedTopSlug ?? null,
    expectedTopKFamilies: prompt.expectedTopKFamilies ?? [],
    expectedResolutionMode: prompt.expectedResolutionMode ?? null,
    passMetric: familyPassMetric,
    result: {
      resolutionMode: result.resolutionMode,
      confidence: result.confidence,
      bestGroup: topGroup
        ? {
            slug: topGroup.slug,
            displayName: topGroup.displayName,
            family: topGroup.family,
            capacityMl: topGroup.capacityMl,
            color: topGroup.color,
            score: topGroup.score,
            confidence: topGroup.confidence,
          }
        : null,
      top3Groups: top3Groups.map((group) => ({
        slug: group.slug,
        family: group.family,
        confidence: group.confidence,
      })),
    },
    metrics: {
      topSlugMatch,
      top1FamilyMatch,
      top3FamilyHit,
      resolutionModeMatch,
      pass,
    },
  };
}

async function main() {
  const prompts = JSON.parse(await fs.readFile(PROMPTS_PATH, "utf8"));
  const client = new ConvexHttpClient(CONVEX_URL);
  const startedAt = new Date().toISOString();
  const rows = [];

  for (const prompt of prompts) {
    const result = await client.query("products:resolveProductRequest", {
      searchTerm: prompt.prompt,
      familyLimit: prompt.familyLimit ?? undefined,
      limit: 6,
    });
    rows.push(scorePrompt(prompt, result));
  }

  const summary = {
    promptCount: rows.length,
    passCount: rows.filter((row) => row.metrics.pass).length,
    top1FamilyAccuracy: rows.filter((row) => row.metrics.top1FamilyMatch === true).length,
    top3FamilyRecall: rows.filter((row) => row.metrics.top3FamilyHit === true).length,
    exactSlugHits: rows.filter((row) => row.metrics.topSlugMatch === true).length,
    wrongFamilyCount: rows.filter(
      (row) =>
        row.expectedTopKFamilies.length > 0 &&
        row.result.bestGroup &&
        !row.expectedTopKFamilies.includes(row.result.bestGroup.family)
    ).length,
  };

  const payload = {
    startedAt,
    convexUrl: CONVEX_URL,
    promptsPath: PROMPTS_PATH,
    summary,
    rows,
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2));

  if (PRINT_JSON) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Grace retrieval eval complete: ${summary.passCount}/${summary.promptCount} passing`);
  console.log(`Top-1 family accuracy: ${summary.top1FamilyAccuracy}/${summary.promptCount}`);
  console.log(`Top-3 family recall: ${summary.top3FamilyRecall}/${summary.promptCount}`);
  console.log(`Exact slug hits: ${summary.exactSlugHits}`);
  console.log(`Wrong-family regressions: ${summary.wrongFamilyCount}`);
  console.log(`Saved report to ${OUT_PATH}`);
}

await main();
