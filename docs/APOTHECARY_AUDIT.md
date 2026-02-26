# Apothecary Products Audit

**Source:** [bestbottles.com/apothecary-style-bottles](https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/apothecary-style-bottles.php)  
**Scraped:** 2026-02-26  
**Report:** `data/apothecary_scrape_report.json`

---

## Summary

| Metric | Count |
|--------|-------|
| Products on live apothecary page | **6** |
| Products in our DB (Apothecary family) | **4** |
| **Missing from our Apothecary view** | **2** |

---

## Products on Live Page (6 total)

| Website SKU | Description | Stock | In Our DB? |
|-------------|-------------|-------|------------|
| GB15ApthBlue | 15ml blue glass bottle, blue glass stopper | In Stock | ✅ Yes (Apothecary) |
| GB1ozApth | 30ml clear glass bottle, glass stopper | In Stock | ✅ Yes (Apothecary) |
| GB1ozApthBlue | 30ml blue glass bottle, blue glass stopper | In Stock | ✅ Yes (Apothecary) |
| GB1ozApthGreen | 30ml green glass bottle, green glass stopper | In Stock | ✅ Yes (Apothecary) |
| GBPearClear4ozStpr | 4oz Clear Pear Bottle with Stopper | Out of Stock | ⚠️ Yes but **Decorative** family |
| GBRndClear4ozStpr | 4oz Clear Spherical Bottle with Stopper | Out of Stock | ❌ **Not in DB** |

---

## Gap Analysis

### 1. GBPearClear4ozStpr (4oz Pear)
- **Status:** Exists in our DB as `GB-DEC-CLR-118ML`
- **Issue:** Classified as **Decorative** family, not Apothecary
- **Fix:** Reclassify `family` to `"Apothecary"` and set `bottleCollection` to `"Apothecary Collection"` so it appears when filtering by Apothecary

### 2. GBRndClear4ozStpr (4oz Spherical)
- **Status:** **Not in our database**
- **Fix:** Add as new product. Scrape product page for full specs:
  - URL: `https://www.bestbottles.com/product/` + slug (need to find — likely `Apothecary-style-Clear-glass-spherical-4oz-glass-stopper` or similar)
  - Pricing from live page: $4.50/pc (1pc), $4.28/pc (12pc)
  - Capacity: 118ml (4oz)

---

## Additional Apothecary-Style Products (firecrawl)

The firecrawl URL map shows **18+** additional apothecary-style product URLs not on this category page:

- 2oz clear
- 4oz blue cylindrical jar, clear, blue, green
- 10oz clear, blue, green
- 12oz pear, rectangular bottle, rectangular jar

These may live on other category pages or product detail pages. Consider a broader scrape of all apothecary-style URLs if you want the full catalog.

---

## Recommended Actions

1. **Reclassify GBPearClear4ozStpr** — Update `family` from `Decorative` to `Apothecary` in Convex (or add `bottleCollection: "Apothecary Collection"` for display).
2. **Add GBRndClear4ozStpr** — Scrape its product page, create a new product record, and seed into Convex.
3. **Run scrape script** — `node scripts/scrape_apothecary.mjs` to refresh the report.
