# Convex Product Database — Handoff to Claude Project

## Current State (as of 2026-02-28)

- **Total products in Convex:** 2,281
- **Export file:** `data/convex_products_export_20260228.csv`

---

## Schema v1.2 — Products Table Columns

### Identity
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| productId | string \| null | Optional | BB-{PREFIX}-000-{NNNN} |
| websiteSku | string | Yes | BestBottles.com SKU |
| graceSku | string | Yes | Internal SKU |

### Classification
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| category | string | Yes | Glass Bottle, Component, etc. |
| family | string \| null | Yes | Cylinder, Boston Round, etc. |
| shape | string \| null | Yes | |
| color | string \| null | Yes | |
| capacity | string \| null | Yes | |
| capacityMl | number \| null | Yes | |
| capacityOz | number \| null | Yes | |

### Applicator & Cap (UPDATED in v1.2)
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| applicator | **constrained union** | Yes | See allowed values below |
| capColor | string \| null | Yes | |
| trimColor | string \| null | Yes | |
| capStyle | string \| null | Yes | |
| **capHeight** | **Short \| Tall \| Leather \| null** | **Optional (NEW)** | |
| ballMaterial | string \| null | Optional | Metal/Plastic for rollers |

**Applicator allowed values:** Metal Roller, Plastic Roller, Fine Mist Sprayer, Perfume Spray Pump, Atomizer, Antique Bulb Sprayer, Antique Bulb Sprayer with Tassel, Lotion Pump, Dropper, Reducer, Glass Stopper, Glass Rod, Cap/Closure, Applicator Cap, N/A

### Physical
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| neckThreadSize | string \| null | Yes | e.g. 13-415, 17-415 |
| heightWithCap | string \| null | Yes | |
| heightWithoutCap | string \| null | Yes | |
| diameter | string \| null | Yes | |
| bottleWeightG | number \| null | Yes | |
| caseQuantity | number \| null | Yes | |

### Pricing
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| qbPrice | number \| null | Yes | |
| webPrice1pc | number \| null | Yes | |
| webPrice10pc | number \| null | Yes | |
| webPrice12pc | number \| null | Yes | |

### Content & Status
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| stockStatus | string \| null | Yes | |
| itemName | string | Yes | |
| itemDescription | string \| null | Yes | |
| imageUrl | string \| null | Optional | |
| productUrl | string \| null | Yes | |
| dataGrade | string \| null | Yes | |
| bottleCollection | string \| null | Yes | |

### Fitment (UPDATED in v1.2)
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| fitmentStatus | string \| null | Yes | |
| components | any (array) | Yes | Compatible component SKUs — not in CSV export |
| graceDescription | string \| null | Yes | |
| **assemblyType** | **2-part \| 3-part \| complete-set \| component \| accessory \| null** | **Optional (NEW)** | |
| **componentGroup** | **constrained union** | **Optional (NEW)** | See allowed values below |

**ComponentGroup allowed values:** Fine Mist Sprayer, Perfume Spray Pump, Antique Sprayer, Screw Cap, Short Cap, Tall Cap, Leather Cap, Applicator Cap, Roll-On Cap, Roll-On Fitment, Lotion Pump, Reducer, Dropper Assembly, Glass Stopper

### Meta
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| verified | boolean | Yes | |
| importSource | string | Optional | |
| productGroupId | Id | Optional | FK → productGroups |

---

## Prompt for Claude (copy-paste)

```
This document describes the current state of our Best Bottles Convex product database for reconciliation with your external database.

**As of 2026-02-28:**
- Total products in Convex: 2,281
- Attached CSV: convex_products_export_20260228.csv (or the latest from data/convex_products_export_*.csv)

**Schema v1.2 changes (columns added or constrained):**
1. **applicator** — Now a constrained union (no freeform text). Allowed: Metal Roller, Plastic Roller, Fine Mist Sprayer, Perfume Spray Pump, Atomizer, Antique Bulb Sprayer, Antique Bulb Sprayer with Tassel, Lotion Pump, Dropper, Reducer, Glass Stopper, Glass Rod, Cap/Closure, Applicator Cap, N/A.

2. **capHeight** — NEW optional field. Values: Short, Tall, Leather, or null.

3. **assemblyType** — NEW optional field. Values: 2-part, 3-part, complete-set, component, accessory, or null.

4. **componentGroup** — NEW optional field. Values: Fine Mist Sprayer, Perfume Spray Pump, Antique Sprayer, Screw Cap, Short Cap, Tall Cap, Leather Cap, Applicator Cap, Roll-On Cap, Roll-On Fitment, Lotion Pump, Reducer, Dropper Assembly, Glass Stopper, or null.

**CSV columns (flat fields only; components array excluded):**
productId, websiteSku, graceSku, category, family, shape, color, capacity, capacityMl, capacityOz, applicator, capColor, trimColor, capStyle, capHeight, ballMaterial, neckThreadSize, heightWithCap, heightWithoutCap, diameter, bottleWeightG, caseQuantity, qbPrice, webPrice1pc, webPrice10pc, webPrice12pc, stockStatus, itemName, itemDescription, imageUrl, productUrl, dataGrade, bottleCollection, fitmentStatus, graceDescription, assemblyType, componentGroup, verified, importSource

Please reconcile your database with this export. Flag any discrepancies in product count, SKUs, or field values. The applicator field is now strictly constrained — if your data has values outside the allowed set (e.g. "Orifice Reducer" instead of "Reducer"), map them to the canonical values above before syncing.
```

---

## How to regenerate the export

```bash
# From project root
node scripts/export_products_csv.mjs

# Or specify output path
node scripts/export_products_csv.mjs --output path/to/your/convex_products.csv
```

Output is written to `data/convex_products_export_YYYYMMDD.csv` by default.
