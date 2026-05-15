# Best Bottles Agent Handoff - Product Data, Grace, and Image Generation

Last updated: 2026-05-14

Use this handoff to bring another agent up to speed before starting bulk bottle-family image generation or product-data alignment work.

## Current Git State

- Repository: `asalastudio/best-bottles-website`
- Main branch includes:
  - PR32: launch quick wins and Grace retrieval checkpoint
  - PR33: canonical product colors and grouped Grace retrieval foundation
  - PR34: corrected Grace 9 ml Cylinder roll-on truth
- Current merged main head when this handoff was written: `0fa0159` (`Correct Grace 9ml cylinder roll-on truth (#34)`)
- Important rule: do not assume Convex runtime code has been deployed just because GitHub PRs are merged. Confirm deployment before testing live Grace behavior.

## Source Of Truth Hierarchy

The source of truth is layered:

1. Authoring source: `docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx`
   - Use this as the source for raw product facts, SKU lineage, capacities, dimensions, case quantities, descriptions, and taxonomy intent.
   - Preserve raw values exactly when auditing. Do not silently "fix" the sheet in downstream exports.
2. Taxonomy source: the master sheet Legend/tab taxonomy plus repo docs in `docs/data_alignment/`.
   - Use this to interpret family, collection, applicator, color, and component vocabulary.
3. Runtime source: Convex `products`, `productGroups`, and `fitments`.
   - This is what the catalog UI, PDPs, PDF catalog, Grace retrieval, and image-generation pipeline should consume at runtime.
4. Canonical code contract: `src/lib/canonicalProduct.ts`.
   - This normalizes raw product rows into canonical variant/group read models while preserving raw values and data-quality flags.
5. Shopify role: commerce identity and checkout/sync sink unless explicitly promoted for price or inventory truth.
   - Do not treat Shopify as the product-data authoring source without a deliberate business decision.
6. Sanity role: CMS/editorial content and paper-doll family metadata, not primary product truth.
7. Legacy website role: reference/parity benchmark.
   - Use `bestbottles.com` for SKU/product truth checks when master/Convex disagree, not as the primary runtime source for new work.

Recommended runtime flow:

```text
BestBottles_MasterSheet_v1.4_MASTER.xlsx
  + Legend/taxonomy
  + verified legacy-site references where needed
-> import/normalization scripts
-> Convex products + productGroups + fitments
-> canonical read models in src/lib/canonicalProduct.ts
-> catalog UI, PDPs, PDF export, Shopify sync, Grace, and image-generation manifests
```

## PR34 Product Truth Fix

Known issue before PR34:

- Grace could list incomplete or wrong color coverage for 9 ml bottle questions.
- PR33 broadened color coverage, but the business/product truth was later clarified.

Correct verified truth for standard 9 ml Cylinder roll-on glass colors:

- Amber
- Clear
- Cobalt Blue
- Frosted
- Swirl

Important exclusions:

- White is not a valid 9 ml Cylinder roll-on glass color. White appears from cap/import drift, such as white cap values or compact SKUs where the raw sheet color is misleading.
- Green is not a valid 9 ml Cylinder roll-on glass color. Green can exist in separate decorative/glass-stopper product families, not this Cylinder roll-on family.
- Swirl is verified as 9 ml for Cylinder roll-on. Do not treat Swirl as only 10 ml.

Files changed by PR34:

- `src/lib/canonicalProduct.ts`
  - Compact `Swrl` SKU evidence now canonicalizes to `Swirl` while preserving raw source color and adding `color_derived_from_sku_swirl`.
- `convex/graceSearchUtils.ts`
  - Adds verified 9 ml Cylinder roll-on color constants and detection helpers.
  - Filters the special 9 ml Cylinder roll-on context to verified colors only.
  - Gives Grace explicit warnings not to list White or Green for that family.
- `convex/grace.ts`
  - Applies the same verified 9 ml Cylinder roll-on filter in `searchCatalog`.
- `tests/canonicalProduct.test.ts`
- `tests/graceSearchUtils.test.ts`

Validation that passed before PR34 was merged:

- `pnpm exec tsc --noEmit`
- `pnpm exec eslint --quiet`
- `pnpm exec vitest run`
- `pnpm test:catalog:integrity`
- `pnpm test:grace:matrix`
- `pnpm build`

## Grace Rules For The Next Agent

Grace is a consumer of product truth, not the authority.

Do:

- Use `searchCatalog`, `getBottleComponents`, and canonical Convex data for product answers.
- Preserve raw source values and canonical values separately.
- Include data-quality flags in internal reasoning.
- State uncertainty when compatibility is inferred by thread size rather than verified by explicit fitment data.
- For all-color questions, list every canonical color in the tool coverage line.

Do not:

- Let Grace invent SKUs, colors, compatibility, inventory, or availability.
- Use ElevenLabs behavior as the first explanation for product mismatches. The shared retrieval/tool output is the first place to audit.
- Generate product images from Grace chat output.
- Generate family-scale assets from ad hoc spreadsheet rows that bypass Convex/canonical validation.

## Bulk Image Generation Guardrails

Use `docs/data_alignment/IMAGE_GENERATION_CANONICAL_VARIANT_CONTRACT.md` before generating images.

The image pipeline should consume a canonical variant manifest with one row per sellable variant/image target. The manifest must include:

- `generationBatchId`
- `dataLockStatus`
- `familyCanonical`
- `productGroupKey`
- `productSlug`
- `productTitle`
- `capacityMl`
- `glassColorCanonical`
- `neckThreadSize`
- `applicatorCanonical`
- `graceSku`
- `websiteSku`
- `shopifyProductId`
- `shopifyVariantId`
- `convexProductId`
- `convexProductGroupId`
- `imageRole`
- `outputFilename`
- `sourceReferencePath`
- `status`
- `blockerNotes`

For generated PDP/grid imagery:

- Only generate rows marked ready or locked.
- Block rows missing SKU, group slug, canonical family/color/capacity, or image assignment.
- Do not overwrite existing approved image URLs without an explicit replace decision.
- Write generated image URLs back through the canonical Convex/Shopify sync path, not by hand-editing UI components.

## Recommended Next Steps

1. Confirm Convex deployment status after PR34.
2. Export current runtime product knowledge from Convex.
3. Review the generated product-knowledge workbook with stakeholders.
4. Create the image-generation manifest for one pilot family first.
5. Validate image prompts for 5-10 SKUs manually before any family-scale run.
6. After pilot approval, batch by family/capacity/color/applicator with stable filenames.

## Meta Prompt For The Other Agent

You are joining the Best Bottles codebase after PR32, PR33, and PR34 were merged into main. Your job is to continue product-data alignment and prepare safe bulk bottle-family image generation.

Start from current `main`. Do not branch from stale PR32/PR33 worktrees. Confirm `git log -1` includes `Correct Grace 9ml cylinder roll-on truth (#34)` or newer.

Treat product truth as:

```text
Master sheet + Legend taxonomy
-> normalized Convex products/productGroups/fitments
-> canonical read model in src/lib/canonicalProduct.ts
-> catalog UI, PDP, PDF, Shopify sync, Grace, image manifests
```

Do not use Grace responses, old CSV scratch files, or Shopify alone as source truth. Grace is downstream of Convex/canonical retrieval.

Critical PR34 fact: standard 9 ml Cylinder roll-on glass colors are Amber, Clear, Cobalt Blue, Frosted, and Swirl. White and Green must not be listed for that family. Swirl is verified as 9 ml. White is cap/import drift. Green belongs to separate decorative/glass-stopper contexts when present.

Before image generation, read:

- `docs/data_alignment/IMAGE_GENERATION_CANONICAL_VARIANT_CONTRACT.md`
- `src/lib/canonicalProduct.ts`
- `convex/schema.ts`
- `convex/products.ts`
- `convex/grace.ts`
- `convex/graceSearchUtils.ts`

Deliverables expected:

- one canonical variant manifest per generation batch
- blocked-row report for missing/ambiguous data
- sample prompts for manual review before generation
- stable output filenames tied to `graceSku`, `websiteSku`, and image role
- no Convex or Shopify writes without explicit approval
