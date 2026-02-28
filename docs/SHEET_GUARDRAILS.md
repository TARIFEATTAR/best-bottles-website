# Best Bottles — Sheet Guardrails & Source of Truth

**Purpose:** Clarify which sheets exist, how they're used, and how to treat them as sources of truth.

---

## 1. Sheet Inventory

| Sheet | Path | Product Count | Last Updated | Used in Code? |
|-------|------|---------------|--------------|---------------|
| **Old Master (Blueprint)** | `docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx` | 3,179 (per Legend) | 2026-02-23 | ✅ Yes — primary source |
| **New Focus/Verify** | `docs/Master_List_Focus_Verify_02242026.xlsx` | Unknown | 2026-02-24 | ❌ No |
| **Missing Products Audit** | `docs/MasterSheet_MissingProducts_Audit.xlsx` | Output only | Generated | ❌ No (output) |
| **Product Data Audit** | `docs/PRODUCT_DATA_AUDIT.xlsx` | Output only | Generated | ❌ No (output) |
| **Random Family Samples** | `docs/random_family_samples.xlsx` | Sample | Unknown | ❌ No |
| **Fitment (ODS)** | `docs/Bottles and Fitment options.ods` | Fitment rules | Unknown | ✅ Yes (build_fitment_matrix.py) |

---

## 2. Old Master Sheet — Structure & Role

**File:** `BestBottles_MasterSheet_v1.4_MASTER.xlsx`

**Sheets:**
- **Master Products** (or sheet index 0) — main product list
- **Component** — component products (caps, sprayers, etc.)
- **Legend** — taxonomy and codebook

**Legend contents (from `docs/legend-dump.md`):**
- Database overview (3,179 products, pricing tiers)
- Category → Family → Shape hierarchy
- Family codebook (Cylinder, Boston Round, etc.) with Grace codes
- Product ID prefix codebook (BB-GB, BB-CL, etc.)
- Grace SKU formula
- Color, Cap Color, Applicator codebooks
- Data grade definitions
- Known data issues

**Scripts that use it:**
- `build_grace_master.py` — Family, Category, Grace SKU, Thread Size (sheet 0)
- `build_missing_master.py` — "Master Products" sheet
- `reconcile_master_sheet.py` — "Master Products" sheet
- `import_master_components.py` — "Component" sheet
- `backfill_product_ids.py` — Product ID backfill
- `legend_restore.py` — Legend as taxonomy source of truth

**Policy (from `legend_restore.py`):**
> "The Legend sheet in BestBottles_MasterSheet_v1.4_MASTER.xlsx is the single source of truth for all taxonomy values."

---

## 3. New Focus/Verify Sheet — Current Status

**File:** `Master_List_Focus_Verify_02242026.xlsx`

**Status:**
- Not referenced in any code
- Likely a manual verification/audit sheet (Feb 24, 2026)
- May contain corrections or a subset of products
- Relationship to the old master is undocumented

**Open questions:**
1. Is it a subset, a full replacement, or a delta of the old master?
2. Which columns does it have vs the old master?
3. Should it become the new source of truth, or feed corrections into the old master?

---

## 4. Data Flow (Current)

```
BestBottles_MasterSheet_v1.4_MASTER.xlsx (sheet 0)
         +
bestbottles_raw_website_data.json (scraped)
         │
         ▼
   build_grace_master.py
         │
         ▼
   grace_products_final.json  ──►  seed.mjs  ──►  Convex
```

**Important:** `grace_products_clean.json` is used by many scripts but is separate from `grace_products_final.json`. The seed uses `grace_products_final.json`. The relationship between `grace_products_clean` and `grace_products_final` is not clearly documented.

---

## 5. Guardrails — Recommended Decisions

### A. Define the canonical product list

Choose one:

1. **Old Master only** — Keep `BestBottles_MasterSheet_v1.4_MASTER.xlsx` as source of truth.
2. **New sheet only** — Make `Master_List_Focus_Verify_02242026.xlsx` the new source (requires code changes).
3. **Merge** — Use the new sheet to correct the old master, then keep the old master as canonical.

### B. Preserve the Legend

The Legend in the old master is the taxonomy reference. Even if you switch to the new sheet:

- Export the Legend to a standalone doc (e.g. `docs/LEGEND_REFERENCE.md`).
- Or keep the Legend sheet in the canonical workbook.
- Ensure any new sheet or merge respects Legend values (Family, Applicator, Color, etc.).

### C. Document the new sheet

Before changing anything:

1. List all sheets and columns in `Master_List_Focus_Verify_02242026.xlsx`.
2. Compare row count and column set to the old master.
3. Identify overlaps and differences (e.g. SKUs only in one sheet).
4. Decide which sheet "wins" for each field when they conflict.

### D. Single source of truth

After the decision:

1. Update `build_grace_master.py` (and any other import scripts) to read from the chosen sheet.
2. Add a `docs/SOURCE_OF_TRUTH.md` that states:
   - Which file is canonical
   - Which sheets/tabs are used
   - How the new sheet (if used) feeds into it
3. Add a short README or comment in the repo root pointing to `SOURCE_OF_TRUTH.md`.

### E. Audit script

Add a script (e.g. `scripts/audit_sheet_sources.py`) that:

- Compares the old master, new sheet, and `grace_products_final.json`.
- Reports: row counts, SKUs only in one source, conflicting Family/Category.
- Can be run before/after any import or merge.

---

## 6. Suggested Next Steps

1. **Inspect the new sheet** — Open `Master_List_Focus_Verify_02242026.xlsx`. Document sheet names, columns, row count, date.
2. **Compare to the old master** — Run a comparison (manually or via script) on Website SKU / Grace SKU. List: in both, only in old, only in new.
3. **Choose a strategy** — Old-only, new-only, or merge. Document the choice in `docs/SOURCE_OF_TRUTH.md`.
4. **Preserve the Legend** — Copy Legend content to `docs/LEGEND_REFERENCE.md` (or similar) so it's not lost if the workbook changes.
5. **Update the pipeline** — Point `build_grace_master.py` (and related scripts) at the chosen source. Add the audit script and run it regularly.

---

## 7. Quick Reference — What Uses What

| Script | Reads | Writes |
|--------|-------|--------|
| `build_grace_master.py` | Old Master (sheet 0), `bestbottles_raw_website_data.json` | `grace_products_final.json`, `grace_products_final.csv` |
| `seed.mjs` | `grace_products_final.json` | Convex |
| `build_missing_master.py` | Old Master (Master Products), `grace_products_clean.json` | `master_sheet_missing.json` |
| `import_master_components.py` | Old Master (Component), `grace_products_clean.json` | `grace_products_clean.json` |
| `legend_restore.py` | `grace_products_clean.json` | `grace_products_clean.json` |
| `reconcile_master_sheet.py` | Old Master (Master Products) | (reconciliation output) |

**Note:** `grace_products_clean.json` vs `grace_products_final.json` — these are two different files. Clarify which is the intended source for Convex and which scripts should use which file.
