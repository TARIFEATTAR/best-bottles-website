# Data Alignment Templates

Templates and reference files for aligning product data with Convex and the Best Bottles UI.

## Files

| File | Purpose |
|------|---------|
| **CONVEX_PRODUCT_ALIGNMENT_WORKBOOK.xlsx** | Excel workbook with all templates and column reference. Run `python3 scripts/generate_alignment_workbook.py` to regenerate. |
| **CONVEX_PRODUCT_ALIGNMENT_TEMPLATE.csv** | Product template for data entry. Row 1 = headers, Row 2 = UI status, Row 3 = type, Row 4 = notes. Rows 5+ = empty for data. |
| **CONVEX_PRODUCT_GROUP_TEMPLATE.csv** | Product group template. Same structure. |
| **CONVEX_COLUMN_REFERENCE.csv** | Full reference: every column in Convex, which table it lives in, UI usage, and what's missing. |

## Usage

1. **Audit existing data:** Export Convex products to CSV, compare against the template headers. Identify columns with missing or inconsistent values.
2. **Add new data:** Use the template as a checklist. Row 2 shows where each field appears (Filter, Catalog, PDP, or Internal).
3. **Gap analysis:** Use `CONVEX_COLUMN_REFERENCE.csv` — filter `MissingInUI = Yes` to see columns in Convex not yet surfaced in the UI.

## Convex vs UI — What's Missing

**In Convex but not in UI (by design):**
- `productId`, `qbPrice`, `dataGrade`, `fitmentStatus`, `verified`, `importSource`, `productGroupId`
- `capacityOz` — optional; rarely needed if capacity (ml) shown

**All user-facing product fields are now in the PDP.** See `docs/CONVEX_COLUMNS_UI_MAPPING.md` for full mapping.
