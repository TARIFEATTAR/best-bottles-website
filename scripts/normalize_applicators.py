import json
from collections import Counter

with open("data/grace_products_clean.json") as f:
    products = json.load(f)

# ── Normalization Map ─────────────────────────────────────────
# Each entry: old_value → new_value (or None to clear the field)
APPLICATOR_MAP = {
    "Roller":        "Plastic Roller",   # bottle bundles w/ plastic roller
    "Roller Ball":   "Plastic Roller",   # standalone plastic roller caps
    "Metal Roll-On": "Metal Roller",     # mislabeled metal roller bundles
    "Roll-On":       "Metal Roller",     # same — confirmed metal in product name
    "Cap/Closure":   None,               # NOT an applicator — clear this field
}

# Count before
before = Counter(p.get("applicator") for p in products)

changed = 0
cleared = 0
flags   = []

for product in products:
    app = product.get("applicator")
    if app in APPLICATOR_MAP:
        new_val = APPLICATOR_MAP[app]
        if new_val is None:
            product["applicator"] = None
            cleared += 1
        else:
            product["applicator"] = new_val
            changed += 1

# ── Flag: no standalone metal roller caps in catalog ──────────
# Add a catalog-level note to the first item as a metadata marker (just track via print)
metal_roller_standalones = [
    p for p in products
    if p.get("applicator") == "Metal Roller"
    and p.get("category") != "Glass Bottle"
]

# Count after
after = Counter(p.get("applicator") for p in products)

# ── Print Report ──────────────────────────────────────────────
print("=" * 60)
print("APPLICATOR NORMALIZATION REPORT")
print("=" * 60)
print(f"\nTotal items processed: {len(products)}")
print(f"Labels consolidated (changed): {changed}")
print(f"Labels cleared (Cap/Closure → null): {cleared}")

print("\n── BEFORE ──────────────────────────────")
for app, cnt in sorted(before.items(), key=lambda x: -x[1]):
    label = app if app else "(null/None)"
    print(f"  {label:<35}: {cnt}")

print("\n── AFTER ───────────────────────────────")
for app, cnt in sorted(after.items(), key=lambda x: -x[1]):
    label = app if app else "(null/None)"
    marker = " ✅" if app in ("Plastic Roller", "Metal Roller") else ""
    print(f"  {label:<35}: {cnt}{marker}")

print("\n── CLEAN ROLLER COUNTS ─────────────────")
plastic = [p for p in products if p.get("applicator") == "Plastic Roller"]
metal   = [p for p in products if p.get("applicator") == "Metal Roller"]

plastic_bundles    = [p for p in plastic if p.get("category") == "Glass Bottle"]
plastic_standalone = [p for p in plastic if p.get("category") != "Glass Bottle"]
metal_bundles      = [p for p in metal   if p.get("category") == "Glass Bottle"]
metal_standalone   = [p for p in metal   if p.get("category") != "Glass Bottle"]

print(f"  Plastic Roller — total: {len(plastic)}")
print(f"    └─ Bottle+roller bundles    : {len(plastic_bundles)}")
print(f"    └─ Standalone roller caps   : {len(plastic_standalone)}")
print(f"  Metal Roller   — total: {len(metal)}")
print(f"    └─ Bottle+roller bundles    : {len(metal_bundles)}")
print(f"    └─ Standalone roller caps   : {len(metal_standalone)}")

print("\n── ⚠️  FLAGS ────────────────────────────")
if not metal_standalone:
    print("  FLAG: No standalone metal roller cap components in catalog.")
    print("        Metal roller is only available as a bottle+cap bundle.")
    print("        Consider adding standalone metal roller SKUs from BestBottles.com")
    print("        (e.g. 9ml metal roller plugs sold as individual components).")
print()

# ── Save ──────────────────────────────────────────────────────
with open("data/grace_products_clean.json", "w") as f:
    json.dump(products, f, indent=2)

print(f"✅ Saved {len(products)} items to data/grace_products_clean.json")
