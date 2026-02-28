# Convex Product Database — All Columns & UI Mapping

**Purpose:** List every column in the Convex product database and show which are used in the UI for filtering, display, or search.

**Data alignment templates:** See `docs/data_alignment/` for CSV/Excel templates with all headers pre-defined, plus a column reference for gap analysis. Run `python3 scripts/generate_alignment_workbook.py` to regenerate the Excel workbook.

---

## 1. Products Table — All Columns

| Column | Type | In Catalog Filter? | In Catalog Display? | In PDP Display? | Notes |
|--------|------|--------------------|--------------------|-----------------|-------|
| **productId** | string \| null | ❌ | ❌ | ❌ | Internal anchor (BB-{PREFIX}-000-{NNNN}) |
| **websiteSku** | string | ❌ | ❌ | ✅ | Shown as watermark on PDP image |
| **graceSku** | string | ❌ | ❌ | ✅ | In component cards, FitmentDrawer |
| **category** | string | ✅ | ✅ | ✅ | Filter + card label + specs |
| **family** | string \| null | ✅ | ✅ | ✅ | Filter + card + breadcrumb + specs |
| **shape** | string \| null | ❌ | ❌ | ✅ | PDP specs |
| **color** | string \| null | ✅ | ✅ | ✅ | Filter + card + specs + glass swatches |
| **capacity** | string \| null | ✅ | ✅ | ✅ | Filter + card + specs |
| **capacityMl** | number \| null | ✅ | ❌ | ❌ | Used for capacity filter/sort (via group) |
| **capacityOz** | number \| null | ❌ | ❌ | ❌ | **Not in UI** |
| **applicator** | union | ✅ | ✅ | ✅ | Via applicatorTypes on group; PDP specs |
| **capColor** | string \| null | ❌ | ❌ | ✅ | PDP specs + variant selector |
| **trimColor** | string \| null | ❌ | ❌ | ✅ | PDP specs + variant selector |
| **capStyle** | string \| null | ❌ | ❌ | ✅ | PDP specs + variant selector |
| **capHeight** | Short \| Tall \| Leather \| null | ❌ | ❌ | ✅ | PDP specs |
| **ballMaterial** | string \| null | ❌ | ❌ | ✅ | PDP specs (Metal/Plastic for rollers) |
| **neckThreadSize** | string \| null | ✅ | ✅ | ✅ | Filter + card + specs |
| **heightWithCap** | string \| null | ❌ | ❌ | ✅ | PDP specs |
| **heightWithoutCap** | string \| null | ❌ | ❌ | ✅ | PDP specs |
| **diameter** | string \| null | ❌ | ❌ | ✅ | PDP specs |
| **bottleWeightG** | number \| null | ❌ | ❌ | ✅ | PDP specs |
| **caseQuantity** | number \| null | ❌ | ❌ | ✅ | PDP specs |
| **qbPrice** | number \| null | ❌ | ❌ | ❌ | **Not in UI** |
| **webPrice1pc** | number \| null | ✅ | ✅ | ✅ | Via priceRangeMin; PDP price |
| **webPrice10pc** | number \| null | ❌ | ❌ | ✅ | PDP (if shown) |
| **webPrice12pc** | number \| null | ❌ | ❌ | ✅ | PDP bulk price |
| **stockStatus** | string \| null | ❌ | ❌ | ✅ | PDP "In Stock" badge |
| **itemName** | string | ✅ | ❌ | ✅ | Search; PDP title |
| **itemDescription** | string \| null | ❌ | ❌ | ✅ | JSON-LD; could show in PDP |
| **imageUrl** | string \| null | ❌ | ✅ | ✅ | Card hero; PDP main image |
| **productUrl** | string \| null | ❌ | ❌ | ✅ | PDP "View on BestBottles.com" link |
| **dataGrade** | string \| null | ❌ | ❌ | ❌ | **Not in UI** |
| **bottleCollection** | string \| null | ✅ | ❌ | ✅ | Filter (collection); PDP specs |
| **fitmentStatus** | string \| null | ❌ | ❌ | ❌ | **Not in UI** |
| **components** | array | ❌ | ❌ | ✅ | PDP compatible components |
| **graceDescription** | string \| null | ❌ | ❌ | ✅ | PDP description (preferred over itemDescription) |
| **assemblyType** | 2-part \| 3-part \| etc. | ❌ | ❌ | ✅ | PDP specs |
| **componentGroup** | string \| null | ❌ | ❌ | ✅ | PDP specs |
| **verified** | boolean | ❌ | ❌ | ❌ | **Not in UI** |
| **importSource** | string \| null | ❌ | ❌ | ❌ | **Not in UI** |
| **productGroupId** | Id | ❌ | ❌ | ❌ | Internal FK |

---

## 2. Product Groups Table — All Columns

| Column | Type | In Catalog Filter? | In Catalog Display? | In PDP Display? | Notes |
|--------|------|--------------------|--------------------|-----------------|-------|
| **slug** | string | ✅ | ❌ | ✅ | URL key; search |
| **displayName** | string | ✅ | ✅ | ✅ | Search; card title; PDP title |
| **family** | string | ✅ | ✅ | ✅ | Filter + card + PDP |
| **capacity** | string \| null | ✅ | ✅ | ✅ | Filter + card + PDP |
| **capacityMl** | number \| null | ✅ | ❌ | ❌ | Used for sort/filter |
| **color** | string \| null | ✅ | ✅ | ✅ | Filter + card + PDP |
| **category** | string | ✅ | ✅ | ✅ | Filter + card + PDP |
| **bottleCollection** | string \| null | ✅ | ❌ | ✅ | Filter (collection); PDP |
| **neckThreadSize** | string \| null | ✅ | ✅ | ✅ | Filter + card + PDP |
| **variantCount** | number | ❌ | ✅ | ✅ | Card badge; PDP badge |
| **priceRangeMin** | number \| null | ✅ | ✅ | ✅ | Filter + card + PDP |
| **priceRangeMax** | number \| null | ✅ | ✅ | ✅ | Card; PDP |
| **shopifyProductId** | string \| null | ❌ | ❌ | ❌ | Future Shopify sync |
| **sanitySlug** | string \| null | ❌ | ❌ | ❌ | Future Sanity sync |
| **heroImageUrl** | string \| null | ❌ | ✅ | ❌ | Card image (fallback) |
| **applicatorTypes** | string[] | ✅ | ❌ | ✅ | Filter; PDP applicator selector |

---

## 3. Catalog Filters (Sidebar)

| Filter | Source | URL Param |
|--------|--------|-----------|
| **Applicator Type** | productGroups.applicatorTypes | `applicators` |
| **Design Families** | productGroups.family | `families` |
| **Capacity** | productGroups.capacity | `capacities` |
| **Color** | productGroups.color | `colors` |
| **Categories** | productGroups.category | `category` |
| **Collection** | productGroups.bottleCollection | `collection` |
| **Component Type** | Derived from displayName/family | `componentType` |
| **Neck Thread Size** | productGroups.neckThreadSize | `threads` |
| **Price Range** | productGroups.priceRangeMin/Max | `priceMin`, `priceMax` |
| **Search** | displayName, family, color, capacity, neckThreadSize, bottleCollection, slug | `search` |

---

## 4. PDP Specs Section (What’s Shown)

From `selectedVariant` (individual product):

- Height (with cap)
- Height (without cap)
- Diameter
- Neck Thread Size
- Bottle Weight
- Case Quantity
- Capacity
- Glass Color
- Applicator
- Ball Material
- Cap Style
- Cap Height
- Trim Finish
- Cap Color
- Shape
- Assembly Type
- Component Group
- Category
- Collection

**Description:** `graceDescription` (preferred) or `itemDescription`.

**External link:** "View on BestBottles.com" link when `productUrl` is present.

---

## 5. Columns NOT in the UI (Gaps)

These product columns exist in Convex but are **not** used for filtering or display:

| Column | Suggestion |
|--------|------------|
| **capacityOz** | Optional PDP spec; rarely needed if capacity (ml) is shown |
| **qbPrice** | Internal only; no UI needed |
| **dataGrade** | Internal quality flag; optional admin badge |
| **fitmentStatus** | Internal; optional "Fitment verified" badge |
| **verified** | Internal; optional "Verified" badge |

**Previously missing, now in PDP:** shape, capHeight, ballMaterial, assemblyType, componentGroup, graceDescription, productUrl.

---

## 6. Summary — Filter Coverage

**Currently filterable by users:**
- Category
- Collection (bottleCollection)
- Applicator Type (Roll-on, Spray, Dropper, Reducer, Lotion Pump)
- Design Family
- Capacity
- Color
- Neck Thread Size
- Price Range
- Component Type (when viewing components)
- Free-text search

**Not filterable but could be:**
- Shape
- Cap Height (Short/Tall/Leather)
- Ball Material (Metal/Plastic for roll-ons)
- Stock Status (In Stock only)
- Assembly Type

---

## 7. Recommendations

1. ~~**Add to PDP specs:** `capHeight`, `ballMaterial`, `assemblyType`, `graceDescription`~~ ✅ Done
2. ~~**Add productUrl:** "View on BestBottles" link~~ ✅ Done
3. **Consider shape filter:** If shape varies meaningfully within families
4. **Stock filter:** Add "In Stock" filter if out-of-stock products exist
5. **Cap height filter:** For caps/components, Short vs Tall could be useful
