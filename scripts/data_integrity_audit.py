import json
from collections import Counter, defaultdict

with open("data/grace_products_clean.json") as f:
    data = json.load(f)

total = len(data)
print("=" * 60)
print(f"FULL DATA INTEGRITY AUDIT — grace_products_clean.json")
print(f"Total items: {total}")
print("=" * 60)

# ── 1. URL Status ──────────────────────────────────────────────
has_url   = [i for i in data if i.get("productUrl")]
no_url    = [i for i in data if not i.get("productUrl")]
verified  = [i for i in data if i.get("verified") is True]

print(f"\n📡 PRODUCT URL STATUS")
print(f"  Has productUrl   : {len(has_url):>5}  ({round(len(has_url)/total*100)}%)")
print(f"  Missing productUrl: {len(no_url):>5}  ({round(len(no_url)/total*100)}%)")
print(f"  Verified (live)  : {len(verified):>5}  ({round(len(verified)/total*100)}%)")

# ── 2. Image Status ────────────────────────────────────────────
has_img = [i for i in data if i.get("image") or i.get("imageUrl")]
no_img  = [i for i in data if not (i.get("image") or i.get("imageUrl"))]
print(f"\n🖼️  IMAGE STATUS")
print(f"  Has image        : {len(has_img):>5}  ({round(len(has_img)/total*100)}%)")
print(f"  Missing image    : {len(no_img):>5}  ({round(len(no_img)/total*100)}%)")

# ── 3. Pricing Status ──────────────────────────────────────────
has_1pc  = [i for i in data if i.get("webPrice1pc")]
has_10pc = [i for i in data if i.get("webPrice10pc")]
has_12pc = [i for i in data if i.get("webPrice12pc")]
no_price = [i for i in data if not i.get("webPrice1pc") and not i.get("qbPrice")]

print(f"\n💰 PRICING STATUS")
print(f"  Has webPrice1pc  : {len(has_1pc):>5}  ({round(len(has_1pc)/total*100)}%)")
print(f"  Has webPrice10pc : {len(has_10pc):>5}  ({round(len(has_10pc)/total*100)}%)")
print(f"  Has webPrice12pc : {len(has_12pc):>5}  ({round(len(has_12pc)/total*100)}%)")
print(f"  No price at all  : {len(no_price):>5}  ({round(len(no_price)/total*100)}%)")

# ── 4. SKU Status ──────────────────────────────────────────────
has_grace_sku   = [i for i in data if i.get("graceSku")]
has_website_sku = [i for i in data if i.get("websiteSku")]
has_both        = [i for i in data if i.get("graceSku") and i.get("websiteSku")]
generic_sku     = [i for i in data if "GENERIC" in (i.get("graceSku") or "").upper()
                   or "GENERIC" in (i.get("websiteSku") or "").upper()]

print(f"\n🔖 SKU STATUS")
print(f"  Has Grace SKU    : {len(has_grace_sku):>5}  ({round(len(has_grace_sku)/total*100)}%)")
print(f"  Has Website SKU  : {len(has_website_sku):>5}  ({round(len(has_website_sku)/total*100)}%)")
print(f"  Has both SKUs    : {len(has_both):>5}  ({round(len(has_both)/total*100)}%)")
print(f"  Generic/bad SKUs : {len(generic_sku):>5}")

# ── 5. The 725 "missing" items ────────────────────────────────
missing_url_by_cat = Counter(i.get("category", "Unknown") for i in no_url)
print(f"\n🔴 THE {len(no_url)} ITEMS MISSING A PRODUCT URL")
print("  By category:")
for cat, cnt in sorted(missing_url_by_cat.items(), key=lambda x: -x[1]):
    print(f"    {cat:<25}: {cnt}")

# Missing URL by family
missing_url_by_family = Counter(i.get("family", "Unknown") for i in no_url)
print("\n  Top 10 families missing URLs:")
for fam, cnt in missing_url_by_family.most_common(10):
    print(f"    {fam:<30}: {cnt}")

# ── 6. Data Grade Distribution ────────────────────────────────
grades = Counter(i.get("dataGrade", "None") for i in data)
print(f"\n📊 DATA GRADE DISTRIBUTION")
for grade, cnt in sorted(grades.items()):
    bar = "█" * int(cnt / total * 40)
    print(f"  Grade {grade:<4}: {cnt:>5} ({round(cnt/total*100):>3}%) {bar}")

# ── 7. What GOOD items look like (have everything) ────────────
complete = [i for i in data
            if i.get("productUrl")
            and i.get("webPrice1pc")
            and (i.get("image") or i.get("imageUrl"))
            and i.get("websiteSku")]
incomplete = total - len(complete)

print(f"\n✅ COMPLETE ITEMS (url + price + image + sku): {len(complete)} ({round(len(complete)/total*100)}%)")
print(f"⚠️  INCOMPLETE ITEMS (missing at least one):   {incomplete} ({round(incomplete/total*100)}%)")

# What's the biggest gap among incomplete items?
missing_breakdown = {
    "No URL":   len(no_url),
    "No Image": len(no_img),
    "No Price": len(no_price),
}
print(f"\n  Breakdown of what's missing:")
for k, v in missing_breakdown.items():
    print(f"    {k:<12}: {v}")

# ── 8. Summary / Action Plan ──────────────────────────────────
print(f"\n{'=' * 60}")
print("SUMMARY & WHAT STILL NEEDS TO BE DONE")
print("=" * 60)
print(f"  1. ✅ Pricing data    : SOLID — {round(len(has_1pc)/total*100)}% have webPrice1pc")
print(f"  2. ✅ SKU coverage    : SOLID — {round(len(has_website_sku)/total*100)}% have websiteSku")
print(f"  3. ⚠️  Product URLs   : {len(no_url)} items need URLs scraped from site")
print(f"  4. ⚠️  Images         : {len(no_img)} items need images")
print(f"  5. {'✅' if not generic_sku else '❌'} Generic SKUs   : {len(generic_sku)} need fixing")
