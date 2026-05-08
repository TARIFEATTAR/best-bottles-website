# Best Bottles Image Pipeline Contract

Last updated: 2026-05-07

This document is the tie-breaker when older image-pipeline notes disagree.
The current system has three separate lanes that must not be blended.

## Lane 1: Paper Doll Components

Purpose: swappable transparent PNG components for the configurator.

Owner repo: Best Bottles.

Current live legacy outputs:

- CYL-5ML and CYL-9ML components: 1000 x 1300 transparent PNG.
- TALLCYL-9ML components: 1000 x 1600 transparent PNG.
- Components layer at position `(0,0)` on a shared transparent canvas.

Target unified PDP output for new or migrated families:

- 2080 x 2288 transparent PNG.
- Exact 10:11 portrait ratio, matching Madison hero and product gallery imagery.
- Components still layer at position `(0,0)` on a shared transparent canvas.

Primary references:

- `AGENTS.md`
- `HANDOFF-CYL-5ML.md`
- `pipeline/paper-doll/configs/families/`
- `pipeline/paper-doll/scripts/`

Rules:

- Madison hero generation does not create Paper Doll components.
- The storefront PDP/catalog visual shell is 10:11. Static hero images and Paper Doll composites should occupy that same visual frame so switching between modes does not change product scale.
- Existing live CYL Paper Doll families may keep their legacy source canvas until they are intentionally migrated.
- New Paper Doll families, especially wider vintage sprayer families, should prefer the 2080 x 2288 transparent source canvas unless there is a documented reason to keep a legacy canvas.
- Do not mix component source canvases inside one Paper Doll family. If a family moves to 2080 x 2288, recanvas every layer and update its Sanity `canvasWidth` / `canvasHeight`.
- Treat 2000 x 2200 as legacy Madison-era input, not a new Paper Doll target.
- Generated folders such as `pipeline/**/output/`, `processing/`, `reference-images/`, and `renders/` are local artifacts, not normal git commits.

## Lane 2: Madison Hero Sync

Purpose: opaque, brand-styled PDP/catalog hero images, including cap-on and cap-off views.

Owner split:

- Best Bottles owns catalog export, PSD/reference preparation, output folders, Sanity/Convex push, and storefront rendering.
- Madison Studio owns prompt assembly, Product Hub data, and image generation runtime.

Canonical final output:

- 2080 x 2288 PNG.
- Exact 10:11 portrait ratio.
- Opaque cream/bone background.
- Muted Luxury / Quiet Drama styling.
- gpt-image-2 source output is 2048 x 2048, then recanvased to 2080 x 2288 with Sharp `extendWith: "copy"`.

Primary references:

- `pipeline/madison-hero-sync/SKILL.md`
- `scripts/madison-pipeline/`
- Madison app: `scripts/local-generate.ts`
- Madison app: `src/lib/product-image/promptAssembler.ts`
- Madison app: `src/config/productImageDimensions.ts`

Rules:

- Treat 2000 x 2200 Madison imagery as legacy input only. Recanvas it before publishing.
- Run fresh AI generation from the Madison app unless a self-contained generator has intentionally been vendored into Best Bottles.
- The Madison `assemblePrompt()` output is authoritative for generated hero images.
- Best Bottles prompt markdown files are useful reference material, but they do not override Madison's live prompt assembler.

## Lane 3: Product Hub Prompt Brain

Purpose: Madison Product Hub becomes the source of truth for vessel specs and image prompt geometry.

Owner repo: Madison Studio.

Best Bottles support files:

- `_skills/madison-bestbottles-product-hub-skill/`
- `pipeline/madison-hero-sync/catalog-enriched.json`
- `convex/exportEnrichedCatalog.ts`

Canonical flow:

```text
Best Bottles Convex catalog
  -> enriched catalog export
  -> Madison product_hubs grouped by family + capacity + glass color
  -> metadata.bottle_specs
  -> Madison assemblePrompt({ sku, productHub })
  -> gpt-image-2
  -> 2080 x 2288 hero PNG
  -> Best Bottles Sanity/Convex push
```

Rules:

- Product Hub schematic fields are the geometry contract when populated.
- If Product Hub schematic dimensions conflict with a visual reference, schematic dimensions win for proportions and the reference guides material, color, and lighting.
- Missing schematic fields should be surfaced as a data-quality gap, not silently guessed.
- Keep Product Hub prompt path behind its rollout flag until a small family passes side-by-side QA.

## Prompt Source Priority

When generating Madison hero imagery, resolve conflicts in this order:

1. Madison Product Hub `metadata.bottle_specs`, especially schematic dimensions.
2. Madison `promptAssembler.ts`, presets, brand block, family shape descriptors, and applicator descriptors.
3. `pipeline/madison-hero-sync/SKILL.md`.
4. `MADISON_STUDIO_BRAND_BRAIN.md`.
5. Older local prompt markdown in `pipeline/image-gen/grid-images/prompts/`.
6. One-off smoke-test prompts or root-level PNG experiments.

## Reactivation Checklist

Before a new generation pass:

1. Confirm Madison app is checked out next to Best Bottles.
2. Confirm `pipeline/madison-hero-sync/catalog-enriched.json` is current.
3. Run Madison generator dry-run for one SKU and inspect the assembled prompt.
4. Confirm final expected canvas is 2080 x 2288.
5. Confirm the selected SKU has enough cap/applicator/color data to avoid generic output.
6. Generate a tiny live sample, then verify dimensions, color, cap/applicator fidelity, and family consistency.
7. Only then run a family batch.
8. Push approved PNGs through `scripts/madison-pipeline/04-push-heroes.ts`.

## Known Footguns

- A 2000 x 2200 smoke test is neither the current Madison hero standard nor the target unified Paper Doll standard.
- The current live CYL Paper Doll canvases are legacy implementation details. The PDP visual frame is already 10:11, so new/migrated Paper Doll families should align to 2080 x 2288 when they need to match Madison hero scale exactly.
- Older Gemini/Nano Banana prompt files are rich in geometry language but use square or legacy output sizes.
- Paper Doll render API outputs may crop transparent pixels for API responses; the live Paper Doll component model preserves full-canvas layer alignment.
- Root-level PNGs are usually proof images. Commit only intentional final assets or move them into a documented asset folder.
