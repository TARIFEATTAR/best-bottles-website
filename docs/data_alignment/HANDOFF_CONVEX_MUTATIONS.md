# Handoff — Convex Parity Mutations

**As of:** 2026-04-23
**Owner:** Jordan
**Status:** Mutations written and committed to `/convex/`. NOT yet run against the Convex database. Next agent's job is to get them deployed and executed.

---

## TL;DR for the next agent

We just finished the live-site parity audit (bestbottles.com ⇄ Convex). Result: 99.7% parity. Three action items — 8 products to import, 3 orphans to clean up, ~2,278 products to backfill with physical specs — were converted into three Convex migration files plus one Node driver script. The code is in the repo. **Nothing has run yet.** Your job: run the codegen, execute the three mutations in order, verify, and report back.

---

## Files written (all committed, none executed)

| File | Purpose | Status |
|------|---------|--------|
| `convex/importMissingLiveProducts.ts` | `internalMutation importMissing` — inserts the 8 live-only products. Idempotent. | Ready |
| `convex/fixOrphanProducts.ts` | `internalMutation fixOrphans` — soft-discontinues 2 orphan products, normalizes 1 typo slug. Idempotent. | Ready |
| `convex/backfillPhysicalSpecs.ts` | Three exports: `backfillBatch` (action), `backfillBatchMutation` (internalMutation), `deriveCapHeightAndBallMaterial` (internalMutation), `fillRateReport` (internalMutation). Non-destructive — only patches empty fields. | Ready |
| `scripts/backfill_physical_specs.mjs` | Node driver for the backfill action. Reads `data/grace_products_clean.json`, chunks into 50-record batches, and calls `backfillPhysicalSpecs:backfillBatch` only when run with `--apply`. | Ready |
| `docs/data_alignment/README.md` | Rewritten with a Keep/Archive verdict on every file in the folder, plus the full run order and verification steps. | Done |

## Reference data these consume

| File | Used by |
|------|---------|
| `docs/data_alignment/PARITY_FINAL_REPORT.json` | The authoritative parity summary. Shows the 8 import SKUs and 3 orphan slugs. |
| `docs/data_alignment/LIVE_ONLY_for_sale_import_ready.json` | Embedded literally inside `importMissingLiveProducts.ts` (enriched with schema-typed category/family/applicator/etc.). |
| `docs/data_alignment/SLUGS_CONVEX_ONLY_not_on_live.json` | The 3 orphan slugs — embedded in `fixOrphanProducts.ts`. |
| `data/grace_products_clean.json` | 2,780-row reference library — consumed by the Node driver at runtime. |

---

## Known gotcha: Convex codegen

The new files reference `internal.backfillPhysicalSpecs.backfillBatchMutation`, which does not exist in `convex/_generated/api.d.ts` yet. `tsc --noEmit` will flag one error on `backfillPhysicalSpecs.ts:167` until codegen runs. **This is expected.**

To fix: run `npx convex dev` (or `npx convex codegen`) once. Convex regenerates `_generated/api.d.ts` from the files in `/convex/`, the types resolve, and the mutations become callable.

There are pre-existing `TS2802` iterator warnings in `grace.ts`, `migrations.ts`, `products.ts` — those are not from the new code and Convex's own build target handles them. Ignore.

---

## Run order

All commands assume working directory is the repo root. `CONVEX_URL` (or `NEXT_PUBLIC_CONVEX_URL`) must be set in the environment that runs step 4 — same URL your `npx convex` CLI uses.

### 1. Regenerate Convex types

```bash
npx convex dev
```

Leave this running in a separate terminal — it also serves as the watcher. Or run it once and kill it after it prints "Convex functions ready!".

### 2. Import the 8 live-only products

```bash
npx convex run importMissingLiveProducts:importMissing
```

**Expected output:** `{ inserted: 8, skipped: 0, total: 8, log: [...], nextSteps: [...] }`.

If `skipped` is non-zero, the mutation already ran (or the SKUs collide with something existing). That's fine — it's idempotent.

**Records will be inserted with:**
- `verified: false`
- `dataGrade: "C"`
- `importSource: "live_site_parity_20260422_phase1"`
- `productGroupId: undefined` (unlinked — see step 6)
- `graceSku = websiteSku = live_sku` (placeholder — see step 6)

### 3. Fix the 3 orphan products

```bash
npx convex run fixOrphanProducts:fixOrphans
```

**Expected output:** Two product groups found and soft-discontinued (variants patched with `stockStatus: "Discontinued"`). The capitalization-typo slug (`Vial-design-1-o-5-ml-amber-glass-white-short-cap`) renamed to lowercase IF no lowercase variant already exists. If no matching productGroups are found, the mutation returns an empty `discontinued` list and logs a `flaggedForReview` note — that's fine, it means the orphans were already cleaned or never existed.

No hard deletes. `portalOrders` references stay intact.

### 4. Backfill physical specs from grace_products_clean.json

```bash
# In the environment where CONVEX_URL is set:
node scripts/backfill_physical_specs.mjs --apply
```

This loops 2,780 records in batches of 50 (~56 action calls). Expect 30–90 seconds.

**Expected output:** Per-batch progress lines, then a summary:
```
Total records processed:  2780
Matched to Convex doc:    ~2278
Unmatched (no Convex):    ~502  ← these are in the reference lib but not in Convex. Most are components / discontinued / aspirational master rows. Not an error.
Total fields patched:     <varies>
```

### 5. Derive capHeight and ballMaterial

Pure self-patch — no external input.

```bash
npx convex run backfillPhysicalSpecs:deriveCapHeightAndBallMaterial
```

**Rules applied:**
- `applicator: "Cap/Closure"` + capStyle contains "Short" OR capColor starts with "Short " → `capHeight: "Short"`
- `applicator: "Cap/Closure"` + capStyle contains "Tall" → `capHeight: "Tall"`
- `applicator: "Cap/Closure"` + capStyle contains "Leather" → `capHeight: "Leather"`
- `applicator: "Metal Roller Ball"` → `ballMaterial: "Metal"`
- `applicator: "Plastic Roller Ball"` → `ballMaterial: "Plastic"`

### 6. Confirm the fill rates moved

```bash
npx convex run backfillPhysicalSpecs:fillRateReport
```

Compare before/after. Baselines (pre-run) from `grace_products_clean.json`:
- capColor: 95.3%
- heightWithCap: 99.4%
- diameter: 99.4%
- bottleWeightG: 77.9%
- caseQuantity: 73.7%
- neckThreadSize: 95.9%
- capHeight: was 0%, should be substantially non-zero after step 5

---

## Verification after running all six steps

### A. Spot-check the 8 new PDP slugs

They should render without 404s in the UI:
- `/products/black-atomizer-design-5-ml-bottle`
- `/products/black-atomizer-design-5-ml-bottle-dots`
- `/products/cylinder-design-5-ml-glass-bottle-short-white-cap`
- `/products/cylinder-design-9-ml-swirl-glass-bottle-lotion-pump-black-trim-and-cap`
- `/products/cylinder-design-9-ml-swirl-glass-bottle-metal-roller-ball-white-cap`
- `/products/cylinder-design-9-ml-swirl-glass-bottle-plastic-roller-ball-white-cap`
- `/products/pink-atomizer-design-5-ml-bottle-dots`
- `/products/tall-cylinder-design-9-ml-glass-bottle-short-white-cap`

(They may 404 at first because `productGroupId` is unlinked — see "Remaining follow-ups" below.)

### B. Ask Grace

If Grace is hooked up, ask her:
- "Do you have a pink atomizer with dots?" → should surface `GBAtom5PnkDot`.
- "Show me 9ml swirl cylinder roll-ons." → should include the new Metal Roller Ball and Plastic Roller Ball variants.
- "What short-cap 5ml cylinders do you have?" → should include the new `GBCyl5WhtSht`.

If she can't find them, the issue is likely Grace's search index (not the mutation) or a missing `productGroupId` link. See follow-ups.

### C. Count check

```bash
npx convex run backfillPhysicalSpecs:fillRateReport
```

`total` should be `~2,289` (previous 2,281 + 8 new imports).

---

## Remaining follow-ups (not blocking, but worth scheduling)

These were deferred to keep the initial import simple:

1. **Canonical graceSku assignment** for the 8 new records. Currently `graceSku = websiteSku = live_sku`. The canonical pattern is `GB-{FAM}-{COLOR}-{CAP}ML-{APPL}-{SUFFIX}`. Write a one-shot migration that maps the 8 live_skus to canonical graceSkus. Query: `products where importSource = "live_site_parity_20260422_phase1"`.

2. **`productGroupId` linkage** for the 8 new records. Without this, Paper Doll rendering, sibling-group grouping, and catalog-page placement won't work. Match on `family + capacityMl + color` against `productGroups`.

3. **Fitment mapping** for the 8 new records — populate `components[]`.

4. **Flip `verified: true`** once 1–3 are done.

5. **Site-owner cleanup:** the live bestbottles.com sitemap has 350 stale URLs (78 soft-404s, 272 discontinued). Not Convex's problem. Hand them `LIVE_ONLY_soft404s.json` and the discontinued slice of `LIVE_ONLY_classified.json` for their next sitemap prune.

---

## Rollback (if anything goes sideways)

All three mutations are non-destructive:
- `importMissing` only inserts. To undo: query for `importSource: "live_site_parity_20260422_phase1"` and delete.
- `fixOrphans` only patches. To undo: query for `importSource: "orphan_cleanup_20260422"` and revert `stockStatus` (if you know what the prior value was — probably "In Stock").
- `backfillPhysicalSpecs` only patches previously-NULL fields. To undo would require a before-snapshot — there isn't one. Acceptable risk given the non-destructive guard, but if you want a safety net, take a `products` table dump before running step 4.

---

## Quick map of what I did in this session

1. Crawled bestbottles.com sitemap (2,636 URLs) → classified into 2,286 live-for-sale + 350 stale.
2. Diffed against Convex (2,281 products) → 99.7% parity, 8 true misses, 3 true orphans.
3. Built `PARITY_FINAL_REPORT.json` as the authoritative summary.
4. Wrote the three Convex mutations + the Node driver.
5. Rewrote `docs/data_alignment/README.md` with Keep/Archive verdicts on all 19 files in the folder.

None of it has been run against the Convex DB. That's your job.
