# AiOS Shopify PDP Image Pipeline

## Decision

For the current single-PNG PDP phase, Shopify Plus is the production media home.

AiOS/Madison generates and labels images. Shopify stores and serves the approved product media. Convex mirrors the Shopify media URL and IDs so the headless PDP can render the correct variant tile and hero image.

Sanity stays available for editorial CMS content and future paper-doll/layered assets.

## Canonical Data Gate

Do not generate family-scale images until the family has a locked canonical
variant manifest.

Canonical data contract:

```txt
docs/data_alignment/IMAGE_GENERATION_CANONICAL_VARIANT_CONTRACT.md
```

Template:

```txt
docs/data_alignment/IMAGE_GENERATION_CANONICAL_VARIANT_TEMPLATE.csv
```

The canonical manifest is the authority for product identity, color, applicator,
SKU, Shopify IDs, output filenames, and generation status. Grace, PDPs, Shopify
upload, and AiOS/Madison generation should consume that same row-level truth.

## Five-Family Launch Scope

Start with five high-impact families that already have strong generated or reference coverage:

1. Empire
2. Cylinder
3. Elegant
4. Circle
5. Diva

Rollout order:

1. Smoke test: `empire-50ml-clear-18-415-antiquespray-tassel`
2. Finish Empire
3. Cylinder by capacity and applicator group
4. Elegant by capacity
5. Circle by capacity
6. Diva by capacity

## Clean Output Workspace

Generated and approved images live under an ignored pipeline workspace:

```txt
pipeline/aios-shopify-pdp-images/
  00-input/
  01-manifests/
  02-generated/
  03-review/
  04-shopify-ready/
  05-push-reports/
  06-archive/
```

Only docs and scripts should be committed. Generated image binaries should stay out of Git.

## Filename Contract

Approved Shopify-ready files should use both SKU systems:

```txt
{graceSku}__{websiteSku}__pdp-main__v{NNN}.png
```

Example:

```txt
GB-EMP-CLR-50ML-AST-RED__GBEmp50AnSpTslRed__pdp-main__v001.png
```

The image should not contain visible SKU text.

## Manifest Contract

Every upload batch is driven by a CSV manifest:

```csv
productSlug,websiteSku,graceSku,shopifyProductId,shopifyVariantId,optionLabel,imageRole,filename,relativePath,width,height,bytes,sha256,status,shopifyMediaId,shopifyCdnUrl,pushStatus
```

The manifest is the source of truth for upload, assignment, reporting, and Convex patching.

## Smoke Test

Smoke product:

```txt
empire-50ml-clear-18-415-antiquespray-tassel
```

Current smoke manifest:

```txt
pipeline/aios-shopify-pdp-images/01-manifests/2026-05-14-empire-50ml-ast-smoke-test.csv
```

Current Shopify-ready assets:

```txt
pipeline/aios-shopify-pdp-images/04-shopify-ready/empire-50ml-clear-18-415-antiquespray-tassel/
```

Smoke pass requirements:

1. Manifest parses successfully.
2. Every file exists.
3. Every image is `2080x2288`.
4. Every row has a Shopify product ID and variant ID.
5. Dry-run upload resolves every target.
6. No Shopify writes happen until the dry-run report is reviewed.

## Madison Skill Usage

Use Madison for:

- prompt assembly
- Best Bottles brand style
- image-generation consistency
- family/component context
- QA and approval workflow

Do not use the old Sanity push stage as the production destination for this phase.

Existing useful files:

```txt
/Users/jordanrichter/Projects/Madison Studio/madison-app/docs/best-bottles-brand/SKILL.md
/Users/jordanrichter/Projects/Madison Studio/madison-app/scripts/local-generate.ts
pipeline/madison-hero-sync/SKILL.md
```

## Upload Path

Target future script:

```txt
scripts/aios-shopify-images/push-shopify-pdp-media.mjs
```

Required modes:

```bash
node scripts/aios-shopify-images/push-shopify-pdp-media.mjs \
  --manifest pipeline/aios-shopify-pdp-images/01-manifests/2026-05-14-empire-50ml-ast-smoke-test.csv \
  --dry-run

node scripts/aios-shopify-images/push-shopify-pdp-media.mjs \
  --manifest pipeline/aios-shopify-pdp-images/01-manifests/2026-05-14-empire-50ml-ast-smoke-test.csv \
  --apply
```

The script should:

1. Validate manifest rows.
2. Upload approved images to Shopify product media.
3. Assign each media image to the matching Shopify variant.
4. Fetch Shopify CDN URL and media ID.
5. Patch Convex `products.imageUrl`.
6. Write a push report.
