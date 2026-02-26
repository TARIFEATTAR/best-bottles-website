import json
from collections import Counter

with open("data/grace_products_clean.json") as f:
    products = json.load(f)

renamed_bulb   = 0
renamed_tassel = 0
fixed_mislabel = 0

for p in products:
    app = p.get("applicator")
    sku = p.get("websiteSku", "")

    # Fix the misclassified cap first
    if sku == "CP18-415AnSpPnk":
        p["applicator"] = None
        fixed_mislabel += 1
        continue

    if app == "Antique Sprayer":
        p["applicator"] = "Antique Bulb Sprayer"
        renamed_bulb += 1
    elif app == "Antique Sprayer Tassel":
        p["applicator"] = "Antique Tassel Sprayer"
        renamed_tassel += 1

# Verify final counts
after = Counter(p.get("applicator") for p in products)

print("=" * 60)
print("ANTIQUE SPRAYER NORMALIZATION REPORT")
print("=" * 60)
print(f"\nRenamed 'Antique Sprayer' → 'Antique Bulb Sprayer':   {renamed_bulb}")
print(f"Renamed 'Antique Sprayer Tassel' → 'Antique Tassel Sprayer': {renamed_tassel}")
print(f"Fixed misclassified cap (CP18-415AnSpPnk → null):     {fixed_mislabel}")
print()
print("Final counts:")
print(f"  Antique Bulb Sprayer   : {after.get('Antique Bulb Sprayer', 0)}")
print(f"  Antique Tassel Sprayer : {after.get('Antique Tassel Sprayer', 0)}")
print()

# Print the 28 items still missing URLs (for scraping)
missing_url = [p for p in products
               if p.get("applicator") == "Antique Bulb Sprayer"
               and not p.get("productUrl")]

print(f"Items still needing URL scrape: {len(missing_url)}")
for p in missing_url:
    print(f"  {p.get('websiteSku'):<35} {p.get('itemName', '')[:55]}")

with open("data/grace_products_clean.json", "w") as f:
    json.dump(products, f, indent=2)

print(f"\n✅ Saved {len(products)} items to data/grace_products_clean.json")
