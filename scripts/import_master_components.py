"""
import_master_components.py

Imports all 728 component records from the master sheet's
'Component' tab into grace_products_clean.json.

Rules:
- Only add items not already present (match by websiteSku)
- Preserve all legend taxonomy values exactly as-is
- Map master sheet columns → grace_products_clean.json field names
- Flag any record with missing thread size for review
"""
import json
import openpyxl
from collections import Counter

# ── Load existing data ────────────────────────────────────────
with open("data/grace_products_clean.json") as f:
    existing = json.load(f)

existing_skus = {
    (p.get("websiteSku") or "").strip().lower()
    for p in existing
}

print(f"Existing items in grace_products_clean.json: {len(existing)}")
print(f"Unique existing websiteSkus: {len(existing_skus)}")

# ── Load master sheet Component tab ──────────────────────────
wb = openpyxl.load_workbook(
    "docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx",
    read_only=True,
    data_only=True
)
comp_sheet = wb["Component"]
rows = list(comp_sheet.iter_rows(values_only=True))
header = rows[0]

# Map column name → index
col = {str(h).strip(): i for i, h in enumerate(header) if h is not None}
print(f"\nComponent sheet columns: {list(col.keys())}")
print(f"Total component rows in master sheet: {len(rows) - 1}")

# ── Helper: safe float ────────────────────────────────────────
def safe_float(val):
    try:
        return float(val) if val is not None else None
    except:
        return None

# ── Process each component row ────────────────────────────────
new_items = []
already_present = []
skipped_no_sku = []

for row in rows[1:]:
    def g(col_name):
        idx = col.get(col_name)
        if idx is None:
            return None
        val = row[idx]
        if val is None:
            return None
        return str(val).strip() if isinstance(val, str) else val

    website_sku = g("Website SKU")
    grace_sku   = g("Grace SKU")

    if not website_sku and not grace_sku:
        skipped_no_sku.append(row)
        continue

    # Check if already in dataset
    check_key = (website_sku or "").strip().lower()
    if check_key in existing_skus:
        already_present.append(website_sku)
        continue

    # Build the product record — legend-compliant field names
    item = {
        "websiteSku":       website_sku,
        "graceSku":         grace_sku,
        "category":         g("Category") or "Component",
        "family":           g("Family"),
        "shape":            g("Shape"),
        "color":            None,  # Components don't have glass color
        "capacity":         g("Capacity"),
        "capacityMl":       safe_float(g("Capacity (ml)")),
        "capacityOz":       None,
        "applicator":       g("Applicator"),
        "capColor":         g("Cap Color"),
        "trimColor":        g("Trim Color"),
        "capStyle":         g("Cap Style"),
        "neckThreadSize":   g("Neck Thread Size"),
        "heightWithCap":    g("Height with Cap"),
        "heightWithoutCap": g("Height without Cap"),
        "diameter":         g("Diameter"),
        "bottleWeightG":    safe_float(g("Bottle Weight (g)")),
        "caseQuantity":     None,
        "qbPrice":          safe_float(g("QB Price")),
        "webPrice1pc":      safe_float(g("Web Price (1pc)")),
        "webPrice10pc":     safe_float(g("Web Price (10pc)")),
        "webPrice12pc":     safe_float(g("Web Price (12pc)")),
        "stockStatus":      g("Stock Status"),
        "itemName":         g("Item Name") or f"{g('Family')} {website_sku}",
        "itemDescription":  g("Item Description"),
        "productUrl":       None,  # Not in master sheet — to be scraped
        "dataGrade":        g("Data Grade"),
        "bottleCollection": None,
        "fitmentStatus":    "component",  # Components don't have fitment — they ARE fitment
        "components":       None,
        "graceDescription": None,
        "verified":         False,
        "_source":          "master_sheet_v1.4_component_tab",
    }

    new_items.append(item)

wb.close()

# ── Report ────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"IMPORT REPORT")
print(f"{'='*60}")
print(f"  Already in dataset (skipped): {len(already_present)}")
print(f"  Skipped (no SKU at all):      {len(skipped_no_sku)}")
print(f"  NEW items to add:             {len(new_items)}")

# Breakdown of new items by family
fam_counts = Counter(i.get("family") for i in new_items)
print(f"\n  New items by family:")
for fam, cnt in sorted(fam_counts.items(), key=lambda x: -x[1]):
    print(f"    {fam or '(none)':<35}: {cnt}")

# Thread size coverage of new items
thread_counts = Counter(i.get("neckThreadSize") for i in new_items)
missing_thread = sum(1 for i in new_items if not i.get("neckThreadSize"))
print(f"\n  Thread size coverage of new components:")
for t, cnt in sorted(thread_counts.items(), key=lambda x: -x[1]):
    print(f"    {t or '(none = no thread needed)':<35}: {cnt}")
print(f"  Components with NO thread size: {missing_thread}")

# Applicator type distribution
app_counts = Counter(i.get("applicator") for i in new_items)
print(f"\n  Applicator types in new components:")
for app, cnt in sorted(app_counts.items(), key=lambda x: -x[1]):
    print(f"    {app or '(none)':<35}: {cnt}")

# ── Merge and save ────────────────────────────────────────────
merged = existing + new_items

with open("data/grace_products_clean.json", "w") as f:
    json.dump(merged, f, indent=2)

print(f"\n{'='*60}")
print(f"✅ Saved {len(merged)} total items to data/grace_products_clean.json")
print(f"   ({len(existing)} existing + {len(new_items)} new components added)")
