"""
legend_restore.py

Reverts all applicator taxonomy changes made today back to the
exact values defined in the BestBottles Master Sheet Legend (section 6C).

POLICY: The Legend sheet in BestBottles_MasterSheet_v1.4_MASTER.xlsx
is the single source of truth for all taxonomy values. No field
should be renamed, merged, or cleared without first verifying
against the Legend.
"""
import json
from collections import Counter

with open("data/grace_products_clean.json") as f:
    products = json.load(f)

before = Counter(p.get("applicator") for p in products)

# ── Revert Map — restore legend-correct values ─────────────────
# Keyed by: current_value → legend_correct_value
REVERT_MAP = {
    # Our renames → back to legend names
    "Plastic Roller":       "Roller Ball",       # standalone caps → RLB per legend
    "Antique Bulb Sprayer": "Antique Sprayer",   # → ASP per legend
    "Antique Tassel Sprayer": "Antique Sprayer Tassel",  # → AST per legend
}

# The trickier one: "Plastic Roller" was merged from both "Roller" (ROL)
# and "Roller Ball" (RLB). We need to restore based on category:
#   - category = Glass Bottle → was originally "Roller" (ROL) — bottle+roller bundle
#   - category = Component/Roll-On Cap → was originally "Roller Ball" (RLB) — standalone cap

# Also restore things that were cleared:
#   - Cap/Closure applicator was nulled for 45 items (category=Component) → restore to "Cap/Closure"
# And restore merged Metal Rollers:
#   - "Metal Roller" items from Boston Round 30ml with graceSku MRO prefix → "Metal Roll-On"
# And restore Roll-On items that were merged into Metal Roller

reverted = 0
plastic_roller_bottles = 0   # Roller (ROL)
plastic_roller_caps = 0       # Roller Ball (RLB)

for p in products:
    app = p.get("applicator")
    cat = p.get("category", "")
    grace_sku = p.get("graceSku", "") or ""
    name = p.get("itemName", "") or ""

    # Restore Plastic Roller split
    if app == "Plastic Roller":
        if cat == "Glass Bottle":
            p["applicator"] = "Roller"        # ROL — bottle+roller bundle
            plastic_roller_bottles += 1
            reverted += 1
        else:
            p["applicator"] = "Roller Ball"   # RLB — standalone cap component
            plastic_roller_caps += 1
            reverted += 1

    # Restore antique sprayer names
    elif app == "Antique Bulb Sprayer":
        p["applicator"] = "Antique Sprayer"
        reverted += 1

    elif app == "Antique Tassel Sprayer":
        p["applicator"] = "Antique Sprayer Tassel"
        reverted += 1

    # Restore Cap/Closure — if category=Component or Roll-On Cap AND applicator is null
    # AND the SKU pattern suggests it's a cap (CMP- prefix in graceSku)
    elif app is None and grace_sku.startswith("CMP-CAP"):
        p["applicator"] = "Cap/Closure"
        reverted += 1

    # Restore Metal Roll-On — items that had MRO in their original graceSku
    elif app == "Metal Roller" and "MRO" in grace_sku:
        p["applicator"] = "Metal Roll-On"
        reverted += 1

    # Restore Roll-On — items where itemName contains "Roll-On" but NOT "Metal"
    elif app == "Metal Roller" and "Roll-On" in name and "Metal Roll-On" not in name and "MRL" not in grace_sku:
        p["applicator"] = "Roll-On"
        reverted += 1

after = Counter(p.get("applicator") for p in products)

print("=" * 70)
print("LEGEND RESTORE REPORT")
print("=" * 70)
print(f"\nTotal reverted: {reverted}")
print(f"  Roller (ROL) — bottle bundles restored : {plastic_roller_bottles}")
print(f"  Roller Ball (RLB) — cap components restored: {plastic_roller_caps}")

print("\n── APPLICATOR VALUES vs LEGEND (AFTER RESTORE) ─────────────────────")
legend_apps = [
    ("Sprayer",                "SPR", 575),
    ("Antique Sprayer",        "ASP", 272),
    ("Antique Sprayer Tassel", "AST", 185),
    ("Atomizer",               "ATM", 23),
    ("Lotion Pump",            "LPM", 275),
    ("Pump",                   "PMP", 18),
    ("Roller Ball",            "RLB", 179),
    ("Metal Roller",           "MRL", 198),
    ("Metal Roll-On",          "MRO", 14),
    ("Roll-On",                "RON", 20),
    ("Roller",                 "ROL", 168),
    ("Cap/Closure",            "CLS", 208),
    ("Reducer",                "RDC", 339),
    ("Dropper",                "DRP", 119),
    ("Glass Stopper",          "GST", 5),
    ("Plug",                   "PLG", 2),
]

print(f"\n  {'Applicator Type':<28} {'Code':<6} {'Legend':<10} {'Current':<10} Status")
print("  " + "-" * 65)
all_match = True
for app_name, code, legend_count in legend_apps:
    current = after.get(app_name, 0)
    if current == legend_count:
        status = "✅ MATCH"
    else:
        status = f"⚠️  off by {current - legend_count:+d}"
        all_match = False
    print(f"  {app_name:<28} {code:<6} {legend_count:<10} {current:<10} {status}")

# Show any values still not in legend
print()
for app, cnt in sorted(after.items(), key=lambda x: -x[1]):
    if app and not any(app == a[0] for a in legend_apps):
        print(f"  ⚠️  NOT IN LEGEND: \"{app}\": {cnt}")

print()
if all_match:
    print("🎉 ALL VALUES MATCH LEGEND!")
else:
    print("⚠️  Some counts still differ — may need manual review")

print("\n── POLICY NOTE ──────────────────────────────────────────────────────")
print("  From this point forward, ALL taxonomy changes MUST be cross-")
print("  referenced against docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx")
print("  Legend sheet BEFORE being applied to grace_products_clean.json.")
print("  The Grace SKU formula depends on these exact values.")

with open("data/grace_products_clean.json", "w") as f:
    json.dump(products, f, indent=2)

print(f"\n✅ Saved {len(products)} items to data/grace_products_clean.json")
