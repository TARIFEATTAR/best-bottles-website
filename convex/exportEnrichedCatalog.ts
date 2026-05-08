/**
 * EXPORT ENRICHED CATALOG — Madison prompt-assembler input
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Returns every product row with the exact fields Madison Studio's prompt
 * assembler reads when building a product image prompt. Output is consumed
 * by madison-app/scripts/local-generate.ts so the prompt PRODUCT
 * SPECIFICATIONS block has all required fields populated and the model
 * doesn't fabricate cap/dimension details.
 *
 * Run:
 *   npx convex run exportEnrichedCatalog:exportEnriched \
 *     > pipeline/madison-hero-sync/catalog-enriched.json
 */

import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

type ProductRow = {
  websiteSku: string;
  graceSku: string;
  productId: string | null;
  category: string;
  family: string | null;
  shape: string | null;
  color: string | null;
  bottleCollection: string | null;
  capacity: string | null;
  capacityMl: number | null;
  capacityOz: number | null;
  applicator: string | null;
  capStyle: string | null;
  capColor: string | null;
  trimColor: string | null;
  capHeight: string | null;
  ballMaterial: string | null;
  neckThreadSize: string | null;
  heightWithCap: number | null;
  heightWithoutCap: number | null;
  diameter: number | null;
  depthMm: number | null;
  widthMm: number | null;
  bottleWeightG: number | null;
  itemName: string;
  itemDescription: string | null;
  graceDescription: string | null;
  imageUrl: string | null;
  imageUrlCapOff: string | null;
  promptReadiness: {
    hasApplicator: boolean;
    hasCapStyle: boolean;
    hasCapColor: boolean;
    hasHeightWithoutCap: boolean;
    hasHeightWithCap: boolean;
    hasDiameter: boolean;
    isReady: boolean;
  };
};

function shapeProduct(p: Doc<"products">): ProductRow {
  const hasApplicator = Boolean(p.applicator && p.applicator !== "N/A");
  const hasCapStyle = Boolean(p.capStyle);
  const hasCapColor = Boolean(p.capColor);
  const hasHeightWithoutCap = Boolean(p.heightWithoutCap);
  const hasHeightWithCap = Boolean(p.heightWithCap);
  const hasDiameter = Boolean(p.diameter);
  const isReady =
    hasApplicator &&
    hasCapStyle &&
    hasCapColor &&
    hasHeightWithoutCap &&
    hasHeightWithCap &&
    hasDiameter;

  return {
    websiteSku: p.websiteSku,
    graceSku: p.graceSku,
    productId: p.productId ?? null,
    category: p.category,
    family: p.family ?? null,
    shape: p.shape ?? null,
    color: p.color ?? null,
    bottleCollection: p.bottleCollection ?? null,
    capacity: p.capacity ?? null,
    capacityMl: p.capacityMl ?? null,
    capacityOz: p.capacityOz ?? null,
    applicator: p.applicator ?? null,
    capStyle: p.capStyle ?? null,
    capColor: p.capColor ?? null,
    trimColor: p.trimColor ?? null,
    capHeight: p.capHeight ?? null,
    ballMaterial: p.ballMaterial ?? null,
    neckThreadSize: p.neckThreadSize ?? null,
    heightWithCap: p.heightWithCap ?? null,
    heightWithoutCap: p.heightWithoutCap ?? null,
    diameter: p.diameter ?? null,
    depthMm: p.depthMm ?? null,
    widthMm: p.widthMm ?? null,
    bottleWeightG: p.bottleWeightG ?? null,
    itemName: p.itemName,
    itemDescription: p.itemDescription ?? null,
    graceDescription: p.graceDescription ?? null,
    imageUrl: p.imageUrl ?? null,
    imageUrlCapOff: p.imageUrlCapOff ?? null,
    promptReadiness: {
      hasApplicator,
      hasCapStyle,
      hasCapColor,
      hasHeightWithoutCap,
      hasHeightWithCap,
      hasDiameter,
      isReady,
    },
  };
}

export const exportEnrichedPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("products").paginate(args.paginationOpts);
    return {
      page: result.page.map(shapeProduct),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const exportEnriched = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("products").collect();
    const products = rows.map(shapeProduct);

    return {
      exportedAt: null,
      total: products.length,
      readyForPrompt: products.filter((p) => p.promptReadiness.isReady).length,
      missingFields: products.filter((p) => !p.promptReadiness.isReady).length,
      products,
    };
  },
});

export const exportEnrichedFamily = query({
  args: { family: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("products")
      .withIndex("by_family", (q) => q.eq("family", args.family))
      .collect();
    const products = rows.map(shapeProduct);

    return {
      exportedAt: null,
      family: args.family,
      total: products.length,
      readyForPrompt: products.filter((p) => p.promptReadiness.isReady).length,
      missingFields: products.filter((p) => !p.promptReadiness.isReady).length,
      products,
    };
  },
});
