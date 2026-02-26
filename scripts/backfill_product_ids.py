"""
backfill_product_ids.py

Adds the `productId` field (e.g. BB-GB-000-0001) to every item
in grace_products_clean.json by matching Website SKU against
the Master Products tab of the master sheet.

This is the 3rd identifier — sits above websiteSku and graceSku.
"""
import json
import openpyxl

# ── Load master sheet — all rows ──────────────────────────────
wb = openpyxl.load_workbook(
    "docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx",
    read_only=True, data_only=True
)
master = wb["Master Products"]
rows = list(master.iter_rows(values_only=True))
header = rows[0]
col = {str(h).strip(): i for i, h in enumerate(header) if h is not None}

# Build lookup: websiteSku → productId
sku_to_pid = {}
pid_to_sku = {}
for row in rows[1:]:
    def g(name):
        idx = col.get(name)
        return row[idx] if idx is not None else None

    sku = str(g("Website SKU") or "").strip()
    pid = str(g("Product ID") or "").strip()
    if sku and pid:
        sku_to_pid[sku] = pid
    if pid and sku:
        pid_to_sku[pid] = sku

wb.close()

print(f"Master sheet SKU→ProductID mappings: {len(sku_to_pid)}")

# ── Load grace products ───────────────────────────────────────
with open("data/grace_products_clean.json") as f:
    products = json.load(f)

# ── Back-fill productId on every record ──────────────────────
matched   = 0
unmatched = 0

for p in products:
    sku = (p.get("websiteSku") or "").strip()
    pid = sku_to_pid.get(sku)
    if pid:
        p["productId"] = pid
        matched += 1
    else:
        p["productId"] = None  # Field exists but null — needs manual review
        unmatched += 1

# ── Report ────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"PRODUCT ID BACK-FILL REPORT")
print(f"{'='*60}")
print(f"  Total items         : {len(products)}")
print(f"  Matched (got ID)    : {matched}  ({round(matched/len(products)*100)}%)")
print(f"  Unmatched (null ID) : {unmatched}  ({round(unmatched/len(products)*100)}%)")

# Sample matched
from collections import Counter
prefix_counts = Counter(
    (p.get("productId") or "")[:5]
    for p in products if p.get("productId")
)
print(f"\n  Product ID prefixes matched:")
for prefix, cnt in sorted(prefix_counts.items(), key=lambda x: -x[1]):
    print(f"    {prefix:<15}: {cnt}")

# Sample unmatched
unmatched_items = [p for p in products if not p.get("productId")]
print(f"\n  Sample unmatched items (no productId found):")
for p in unmatched_items[:10]:
    print(f"    {p.get('websiteSku'):<35} {p.get('itemName', '')[:40]}")

# Save
with open("data/grace_products_clean.json", "w") as f:
    json.dump(products, f, indent=2)

print(f"\n✅ Saved {len(products)} items with productId field populated")
