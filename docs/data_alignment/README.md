# Data Alignment — Catalog Parity + Templates

This folder tracks two related workflows:

1. **Live-site parity** — the April 2026 crawl that reconciled bestbottles.com
   (legacy PHP, source of truth for what we actually sell) with Convex. Final
   status: **99.7% parity**, 8 products to import, 3 orphans to clean up.
2. **Template library** — reference templates and column maps for day-to-day
   data entry into Convex.

## Parity workflow (April 2026)

**Authoritative source:** the live bestbottles.com PDP catalog as of
2026-04-22. `sitemap.xml` listed 2,636 URLs; after filtering soft-404s (78)
and discontinued notices (272), the effective live catalog is 2,286 products.
Convex holds 2,281. Overlap: 2,278 of 2,286 (99.7%).

### What each artifact is for

| File | Role | Keep? |
|------|------|-------|
| **`PARITY_FINAL_REPORT.json`** | Authoritative summary — counts, action items, 8-SKU import list, 3-slug orphan list. **This is the file to reference going forward.** | **Keep** — long-term reference |
| **`LIVE_ONLY_for_sale_import_ready.json`** | The 8 import-ready live-only records with title, description, meta, and tiered pricing. Consumed by `convex/importMissingLiveProducts.ts`. | **Keep** — input to migration |
| **`SLUGS_CONVEX_ONLY_not_on_live.json`** | The 3 orphan slugs. Consumed by `convex/fixOrphanProducts.ts`. | **Keep** — input to migration |
| **`LIVE_ONLY_classified.json`** | Classification buckets: soft_404 (78), discontinued (272), live_for_sale (8), other_empty (0). | **Keep** — explains where the 350 "sitemap-only" entries went |
| **`LIVE_ONLY_full_records_358.json`** | Raw PDP data for all 358 sitemap-only URLs, before classification. | **Archive** — scratch input to classification pass. Safe to delete after the import runs and is verified. |
| **`LIVE_ONLY_soft404s.json`** | Subset of sitemap URLs that return soft-404s. | **Archive** — feed back to site owner if they want to prune sitemap |
| **`SLUGS_LIVE_ONLY_missing_from_convex.json`** | Raw slug list (358) before classification. Superseded by `LIVE_ONLY_classified.json`. | **Archive** |
| **`SLUGS_BOTH_matched.json`** | The 2,278 matched slugs — both in live site and Convex. | **Keep** — audit log, useful for cross-checks |
| **`live_site_all_pdp_slugs.json`** | Raw sitemap.xml slug list (2,636). | **Keep** — raw crawl snapshot |
| **`live_site_all_sku_codes.json`** | Legacy "Item Name" codes scraped from live PDPs. | **Archive** — crawl intermediate |
| **`LIVE_SITE_vs_CONVEX_REPORT.json`** | First-pass parity analysis (before classification of soft-404s). | **Archive** — superseded by `PARITY_FINAL_REPORT.json` |
| **`three_way_sample_report.json`** | Early-pass 25-SKU comparison across live/Convex/master v8.3. | **Archive** — sampling artifact, superseded by full crawl |
| **`live_sample_records.json`** | The 25 stratified sample PDPs pulled for the early-pass report. | **Archive** |
| **`MASTER_v8.3_vs_CONVEX_GAP_REPORT.xlsx`** | Master-vs-Convex row-level gap report from the initial audit. | **Keep** — reference library for backfilling optional specs |

### Convex mutations (the "fix it" step)

Three migrations in `/convex/` address the 3 action items from the parity
report. Run them in this order after reviewing each file:

| Mutation | What it does | How to run |
|----------|--------------|------------|
| `importMissingLiveProducts.ts` | Inserts the 8 live-only products with schema-typed fields, idempotent checks, placeholder graceSku = websiteSku, and pricing pulled from the live tiers. Sets `verified: false`, `importSource: "live_site_parity_20260422_phase1"`, `dataGrade: "C"`. | `npx convex run importMissingLiveProducts:importMissing` |
| `fixOrphanProducts.ts` | Soft-discontinues 2 orphan products (stockStatus = "Discontinued"), normalizes 1 capitalization-typo slug. **No hard deletes** — preserves QB/order history. | `npx convex run fixOrphanProducts:fixOrphans` |
| `backfillPhysicalSpecs.ts` | Patches empty spec fields (heightWithCap, heightWithoutCap, diameter, bottleWeightG, caseQuantity, neckThreadSize, capColor, capStyle, bottleCollection) on matched products, using `data/grace_products_clean.json` (2,780 rows) as the reference library. Only fills NULLs — never overwrites. Plus `deriveCapHeightAndBallMaterial` to derive those two from applicator/capStyle patterns. | 1. `node scripts/backfill_physical_specs.mjs --apply` (batches of 50; omit `--apply` for plan-only dry run) 2. `npx convex run backfillPhysicalSpecs:deriveCapHeightAndBallMaterial` 3. `npx convex run backfillPhysicalSpecs:fillRateReport` — diff before/after |

### Post-migration verification

After running the three migrations:

1. `npx convex run backfillPhysicalSpecs:fillRateReport` — confirm fill-rate
   increases across capColor, heightWithCap, diameter, etc.
2. Spot-check the 8 newly-imported SKUs in the UI (`/products/{slug}`):
   - `black-atomizer-design-5-ml-bottle`
   - `black-atomizer-design-5-ml-bottle-dots`
   - `cylinder-design-5-ml-glass-bottle-short-white-cap`
   - `cylinder-design-9-ml-swirl-glass-bottle-lotion-pump-black-trim-and-cap`
   - `cylinder-design-9-ml-swirl-glass-bottle-metal-roller-ball-white-cap`
   - `cylinder-design-9-ml-swirl-glass-bottle-plastic-roller-ball-white-cap`
   - `pink-atomizer-design-5-ml-bottle-dots`
   - `tall-cylinder-design-9-ml-glass-bottle-short-white-cap`
3. Ask Grace a question that touches one of the 8 — e.g. "do you have a pink
   atomizer with dots?" — to confirm she can find and recommend it.
4. Run Grace self-training smoke tests (see `grace-ai-self-training` skill).

### Known follow-ups after the base import

The 8 imported records have placeholder graceSku values (= websiteSku =
legacy live-site code). Final normalization needs:

- Canonical graceSku assignment following the `GB-{FAM}-{COLOR}-{CAP}ML-{APPL}-{SUFFIX}` pattern.
- `productGroupId` linkage — run a group-mapper over the 8 new records to
  attach them to the right `productGroups` row.
- Fitment `components[]` array population.
- Dimensional specs (mostly null for atomizers, which aren't in the Grace
  clean library).
- Flip `verified: true` after the above passes.

### What to do with the sitemap soft-404s

350 sitemap URLs on bestbottles.com are stale:
- 78 return "product you are trying to view is currently not available"
- 272 return "no longer available for purchase"

These are **the live site owner's problem**, not a Convex problem. If the
site owner wants a cleanup list, hand them `LIVE_ONLY_soft404s.json` and the
"discontinued" slice of `LIVE_ONLY_classified.json`. They should be removed
from sitemap.xml so future crawls don't flag them again.

---

## Template library

Reference templates and column maps for day-to-day data entry into Convex.

### Files

| File | Purpose |
|------|---------|
| **CONVEX_PRODUCT_ALIGNMENT_WORKBOOK.xlsx** | Excel workbook with all templates and column reference. Run `python3 scripts/generate_alignment_workbook.py` to regenerate. |
| **CONVEX_PRODUCT_ALIGNMENT_TEMPLATE.csv** | Product template for data entry. Row 1 = headers, Row 2 = UI status, Row 3 = type, Row 4 = notes. Rows 5+ = empty for data. |
| **CONVEX_PRODUCT_GROUP_TEMPLATE.csv** | Product group template. Same structure. |
| **CONVEX_COLUMN_REFERENCE.csv** | Full reference: every column in Convex, which table it lives in, UI usage, and what's missing. |

### Usage

1. **Audit existing data:** Export Convex products to CSV, compare against the template headers. Identify columns with missing or inconsistent values.
2. **Add new data:** Use the template as a checklist. Row 2 shows where each field appears (Filter, Catalog, PDP, or Internal).
3. **Gap analysis:** Use `CONVEX_COLUMN_REFERENCE.csv` — filter `MissingInUI = Yes` to see columns in Convex not yet surfaced in the UI.

### Convex vs UI — What's Missing

**In Convex but not in UI (by design):**
- `productId`, `qbPrice`, `dataGrade`, `fitmentStatus`, `verified`, `importSource`, `productGroupId`
- `capacityOz` — optional; rarely needed if capacity (ml) shown

**All user-facing product fields are now in the PDP.** See `docs/CONVEX_COLUMNS_UI_MAPPING.md` for full mapping.
