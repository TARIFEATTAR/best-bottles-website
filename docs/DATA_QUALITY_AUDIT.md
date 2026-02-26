# 🔍 Data Quality Audit Report

> **Date:** February 23, 2026
> **Source:** `grace_products_clean.json` (2,354 SKUs)
> **Purpose:** Identify discrepancies before Shopify/Sanity sync

---

## Executive Summary

| Category | Issues Found | Severity |
|----------|-------------|----------|
| Thread size inconsistencies | 19 product groups | 🔴 High |
| Suspicious bottle colors | 25 rare colors (likely errors) | 🟡 Medium |
| Cylinder 5ml specific errors | 4 wrong bottle colors, 2 wrong threads | 🔴 High |
| Missing/null critical fields | applicator 15.7%, capColor 3.6% | 🟡 Medium |
| Redundant cap color naming | 7 groups of similar names | 🟡 Medium |
| Family/category cross-listing | 15 families in multiple categories | 🟢 Low (may be intentional) |
| Pricing structure | Clean ✅ | ✅ OK |

---

## 🔴 FLAG 1: Multiple Thread Sizes Per Product Group

**Problem:** Each bottle family + capacity should have ONE thread size. 19 groups have multiple.

**Why this matters:** Thread size determines what applicators/caps fit. If the thread is wrong, the fitment matrix will recommend incompatible components.

| Product Group | Thread Sizes Found | SKUs | Action Needed |
|--------------|-------------------|------|---------------|
| Cylinder 5ml | 13-415, 13mm, 18-400 | 92 | **Should be 13-415 only** (per Jordan's confirmation). "13mm" is likely the same as 13-415 — standardize. "18-400" is wrong (larger bottle thread). |
| Cylinder 9ml | 13-415, 17-415, 18-400, None | 207 | **Verify** — likely 13-415 for most. 18-400 might be correct for some larger neck variants? |
| Cylinder 50ml | 16.5mm, 18-415 | 47 | Standardize naming |
| Cylinder 28ml | 16mm, 18-415 | 4 | Standardize naming |
| Boston Round 15ml | 18-400, 20-400 | 15 | Verify which is correct |
| Component 0ml | 13-415, 17-415, 18-400, 18-415, 20-410, 8-425 | 83 | Expected — components serve multiple thread sizes |
| Cap/Closure 0ml | 13-415, 15-415, 18-415 | 15 | Expected — caps serve multiple thread sizes |
| Cap 0ml | 13-415, 18-400, 18-415, 20-400, 8-425 | 21 | Expected |
| Dropper 0ml | 18-400, 18-415, 20-400 | 21 | Expected — droppers serve multiple thread sizes |
| Sprayer 0ml | 15-415, 17-415, 18-415 | 34 | Expected |
| Roll-On Cap 0ml | 13-415, 17-415, 20-400 | 26 | Expected |
| Lotion Pump 0ml | 17-415, 18-415 | 10 | Expected |

**Recommendation:**
- ✅ Components/caps/applicators having multiple threads is CORRECT (they're sold for multiple bottle types)
- ⚠️ Actual bottles (Cylinder, Boston Round, etc.) should have ONE thread per size — review and fix

---

## 🔴 FLAG 2: Cylinder 5ml — Specific Errors Identified

**Jordan confirmed the 5ml Cylinder should ONLY have:**
- ✅ Clear, Amber, Cobalt Blue (bottle colors)
- ✅ 13-415 (thread size only)

**But the data contains:**

| Bottle Color | SKUs | Status | Action |
|-------------|------|--------|--------|
| Clear | 29 | ✅ Correct | Keep |
| Amber | 29 | ✅ Correct | Keep |
| Blue | 28 | ⚠️ **WRONG** | Remove or verify — "Blue" vs "Cobalt Blue" distinction? |
| Black | 2 | ⚠️ **WRONG** | Remove — 5ml doesn't come in black |
| Cobalt Blue | 2 | ✅ Correct | Keep (but only 2 SKUs?) |
| Pink | 1 | ⚠️ **WRONG** | Remove — 5ml doesn't come in pink |
| White | 1 | ⚠️ **WRONG** | Remove — 5ml doesn't come in white milk glass |

| Thread Size | SKUs | Status | Action |
|------------|------|--------|--------|
| 13-415 | 82 | ✅ Correct | Keep |
| 13mm | 9 | ⚠️ **Redundant** | Standardize to "13-415" |
| 18-400 | 1 | ⚠️ **WRONG** | Remove — wrong thread for 5ml |

**Additionally:** The "Blue" (28 SKUs) might actually BE "Cobalt Blue" — verify if these are the same color with different naming. If so, standardize all to "Cobalt Blue".

**Pricing note:** $0.31 = per piece, $3.05 = per dozen (not a range on per-piece pricing). The `webPrice1pc` and `webPrice12pc` fields should be labeled clearly.

---

## 🟡 FLAG 3: Rare/Suspicious Bottle Colors (Catalog-wide)

25 bottle colors appear in fewer than 5 SKUs total. Many look like data entry errors:

| Color | Count | Families | Likely Issue |
|-------|-------|----------|-------------|
| Lavender | 1 | Gift Bag | OK — probably correct for accessory |
| Shiny | 1 | Sprayer | ❌ "Shiny" is a finish, not a color |
| Matte Shiny Silver | 1 | Component | ❌ Contradictory name |
| Gold Silver | 1 | Component | ❌ Two colors combined? |
| Matte Red | 1 | Component | Verify |
| Copper Red | 1 | Component | ❌ Two colors combined? |
| Gold Ivory | 1 | Component | ❌ Two colors combined? |
| Gold Lavender Pink | 1 | Component | ❌ Three colors — data entry error |
| Copper Gold | 1 | Roll-On Cap | ❌ Two colors combined? |
| Black Copper | 1 | Roll-On Cap | ❌ Two colors combined? |
| Shiny Black Copper | 1 | Roll-On Cap | ❌ Three descriptors |
| Shiny Copper Pink | 1 | Roll-On Cap | ❌ Three descriptors |
| Shiny Black White | 1 | Component | ❌ Three descriptors |
| Clear Gold | 1 | Component | Verify — could be clear with gold accent? |
| Clear Silver | 1 | Component | Verify |

**Recommendation:** These are likely caps/components where the color describes BOTH the cap and trim colors combined into a single field. Consider splitting into `primaryColor` + `trimColor` or standardizing.

---

## 🟡 FLAG 4: Missing/Null Critical Fields

| Field | Null Count | % | Concern |
|-------|-----------|---|---------|
| **applicator** | 369 | 15.7% | 🟡 Many products have no applicator — are these "bottle only" SKUs? |
| **capColor** | 84 | 3.6% | 🟡 Products without cap color — sold without cap? |
| **neckThreadSize** | 69 | 2.9% | 🟡 Important for fitment — should be filled in |
| **color** | 13 | 0.6% | 🟡 Minor — check which products |
| family | 0 | 0% | ✅ |
| webPrice1pc | 0 | 0% | ✅ |
| stockStatus | 0 | 0% | ✅ |

**Note on applicator nulls:** 369 SKUs (15.7%) have no applicator. These are likely:
- "Bottle only" SKUs (sold without closure)
- Component parts (caps, sprayers sold separately)
- Need to verify: should these show as "None" or "Bottle Only"?

---

## 🟡 FLAG 5: Redundant Cap Color Naming

Cap colors that might need standardization:

| Base Color | Variants in Data | Action |
|-----------|-----------------|--------|
| Silver | Silver (58), Matte Silver (249), Shiny Silver (167), Matte Shiny Silver (1) | "Matte Shiny Silver" is contradictory — fix |
| Gold | Gold (98), Matte Gold (131), Shiny Gold (176) | OK — these ARE different finishes |
| Black | Black (163), Matte Black (22), Shiny Black (179) | OK — these ARE different finishes |
| Copper | Copper (73), Matte Copper (56) | Verify — is "Copper" actually "Shiny Copper"? |
| Red | Red (59), Matte Red (1) | Is that 1 "Matte Red" correct or should be just "Red"? |
| Blue | Blue (11), Matte Blue (13) | Verify — is "Blue" actually "Shiny Blue"? |

---

## 🟢 FLAG 6: Family in Multiple Categories

15 families appear in multiple categories. This is **likely intentional** — the same bottle family (e.g., "Cylinder") comes in both "Glass Bottle" and "Lotion Bottle" versions.

| Family | Categories | Notes |
|--------|-----------|-------|
| Cylinder | Glass Bottle (403), Lotion Bottle (36), Aluminum Bottle (1) | The aluminum one seems wrong |
| Circle | Glass Bottle (186), Lotion Bottle (28) | Probably correct |
| Elegant | Glass Bottle (217), Lotion Bottle (32) | Probably correct |
| Empire | Glass Bottle (75), Lotion Bottle (16) | Probably correct |
| Gift Box | Packaging Box (4), Other (10) | Standardize to one category |

---

## 📋 Recommended Cleanup Process

### Step 1: Fix the Data Sheet (Source of Truth)
Before fixing the database, update the master spreadsheet/data sheet so these corrections are captured for re-importing.

### Step 2: Create a "Data Corrections" JSON Patch File
Rather than editing 2,354 records by hand, create a corrections file:
```json
{
  "threadSizeStandardization": {
    "13mm": "13-415",
    "16mm": "16-415",
    "16.5mm": "16-415"
  },
  "removeProducts": [
    { "graceSku": "GB-CYL-BLK-5ML-*", "reason": "5ml doesn't come in black" },
    { "graceSku": "GB-CYL-PNK-5ML-*", "reason": "5ml doesn't come in pink" },
    { "graceSku": "GB-CYL-WHT-5ML-*", "reason": "5ml doesn't come in white" }
  ],
  "colorRenames": {
    "Blue → Cobalt Blue": "Verify — are these the same?"
  }
}
```

### Step 3: Re-seed Convex with Corrected Data
Once the data sheet is fixed, re-run `scripts/seed.mjs --clear-first` to replace all data.

### Step 4: Validate Before Shopify Sync
Run this audit again after corrections. Every flag should be resolved before pushing to Shopify — once products are in Shopify, corrections are much harder.

---

## ⏭ Next Step

**Jordan:** Please review each flag above and either:
1. ✅ Confirm it's correct as-is
2. ❌ Mark it as needing correction in the data sheet
3. ❓ Flag as "need to check with Grace/supplier"

Once we have your responses, we can build the corrections script and re-seed clean data.
