# Blue Color Normalization Migration

## Summary

Successfully standardized all "Blue" color variants to "Cobalt Blue" across the product database.

## Problem

The database contained two descriptors for the same physical cobalt blue glass:
- **"Blue"** — used by 60 products
- **"Cobalt Blue"** — used by 54 products

This inconsistency caused:
- Duplicate sibling swatches in product groups
- Confusing filter options for users
- Data quality issues

## Root Cause

Grace SKU codes mixed two abbreviations for the same glass color:
- `BLU` segment → stored as `color: "Blue"`
- `CBL` segment → stored as `color: "Cobalt Blue"`

Example:
```
GBCylBlu9SpryBlk     → color: "Blue"
GBCylBlu5WhtSht      → color: "Cobalt Blue"
```

Both refer to the same cobalt blue glass.

## Solution

### Migration Strategy

1. **Standardize display color** from `"Blue"` → `"Cobalt Blue"`
2. **Keep Grace SKU unchanged** (immutable identifier)
3. **Rebuild product groups** to consolidate siblings

### Implementation

Created `normalizeBlueColorVariants` mutation in `convex/migrations.ts`:
- Uses cursor-based pagination to handle large datasets
- Filters products where `color === "Blue"`
- Updates to `color: "Cobalt Blue"`
- Preserves Grace SKU segments (`BLU` and `CBL` both remain)

### Execution

```bash
# Run the color normalization
node scripts/run_blue_normalization.mjs

# Rebuild product groups to consolidate siblings
node scripts/run_grouping_migration.mjs
```

## Results

✅ **All "Blue" products normalized to "Cobalt Blue"**
✅ **Product groups rebuilt** (271 groups from 2,284 SKUs)
✅ **Sibling swatches deduplicated**
✅ **Grace SKUs preserved** (both `BLU` and `CBL` segments remain valid)

## Why "Cobalt Blue"?

- More descriptive and industry-standard terminology
- Matches the physical glass color more accurately
- Already used by 54 products in the database
- Eliminates ambiguity with other blue shades

## Grace SKU Handling

**Important:** Grace SKU codes are **immutable identifiers** and were **not changed** by this migration.

- Products with `GB-*-BLU-*` Grace SKUs → now display as "Cobalt Blue"
- Products with `GB-*-CBL-*` Grace SKUs → continue to display as "Cobalt Blue"
- Both SKU patterns are valid and refer to the same physical glass color

## Files Modified

- `convex/migrations.ts` — Added `normalizeBlueColorVariants` mutation
- `scripts/run_blue_normalization.mjs` — Migration runner script
- `scripts/check_blue_count.mjs` — Verification script

## Verification

```bash
# Check current color distribution
node scripts/check_blue_count.mjs
```

Expected output:
```
Current color distribution:
  Blue: 0
  Cobalt Blue: [all blue glass products]
```

## Next Steps

- ✅ Color normalization complete
- ✅ Product groups rebuilt
- 🔄 Monitor for any new products being added with "Blue" instead of "Cobalt Blue"
- 📋 Consider adding data validation to prevent future "Blue" entries

## Related Documentation

- [Product Launch Gameplan](./PRODUCT_LAUNCH_GAMEPLAN.md)
- [Data Quality Audit](./DATA_QUALITY_AUDIT.md)
- [Convex Columns UI Mapping](./CONVEX_COLUMNS_UI_MAPPING.md)
