"""
scrape_17415_components.py

Targeted scrape of 17-415 thread component pages on BestBottles.com.
Closes three known catalog gaps:
  1. Metal Roller caps (metal ball) — 0 SKUs currently
  2. Plastic Roller caps (plastic ball) — need ball-type verification
  3. Sprayer tops — only 1 (Black), 5 more colors known to exist

Strategy (per user guidance):
  - URL slug        → component type hint ("roller-ball", "sprayer", etc.)
  - Item Description → source of truth ("plastic roller ball plug", "metal roller ball", etc.)
  - Neck Thread Size → must confirm = 17-415
  - Item Type       → capacity range confirms bottle family (1/3oz = 8-10ml)
  
Output: prints discovered SKUs + saves to data/scraped_17415_components.json
"""

import urllib.request
import re
import json
import time

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ── Known and candidate URLs to scrape ────────────────────────────────────────
# Pattern: /product/cylinder-design-9-ml-[color]-glass-bottle-[applicator]-[cap-color]-[trim]
# These come from the BestBottles product page slug structure

# Sprayer variants (user confirmed 6 colors exist, we have Black scraped already)
SPRAYER_URLS = [
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-sprayer-black-trim-and-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-sprayer-shiny-silver-trim-and-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-sprayer-turquoise-trim-and-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-sprayer-red-trim-and-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-sprayer-gold-trim-and-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-sprayer-matte-silver-trim-and-cap",
]

# Plastic roller ball variants — inferred from URL pattern
PLASTIC_ROLLER_URLS = [
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-plastic-roller-ball-shiny-gold-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-plastic-roller-ball-black-dot-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-plastic-roller-ball-shiny-silver-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-plastic-roller-ball-copper-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-plastic-roller-ball-matte-silver-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-plastic-roller-ball-matte-gold-cap",
]

# Metal roller ball variants — inferred from URL pattern
METAL_ROLLER_URLS = [
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-metal-roller-ball-shiny-gold-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-metal-roller-ball-shiny-silver-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-metal-roller-ball-black-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-metal-roller-ball-copper-cap",
    "https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-metal-roller-ball-matte-silver-cap",
]

def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.read().decode("utf-8", errors="ignore"), r.geturl()
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except Exception as e:
        return None, str(e)

def strip_tags(s):
    return re.sub(r'<[^>]+>', ' ', s).strip()

def extract_between(html, label_pattern, stop_pattern=r'<'):
    """Extract text after a label until a stop pattern."""
    m = re.search(label_pattern + r'[^>]*>(.*?)' + stop_pattern, html, re.DOTALL | re.I)
    return strip_tags(m.group(1)) if m else None

def parse_product_page(html, url):
    """
    Extract structured product data from a BestBottles product page.
    Uses item description as the source of truth for classification.
    """
    result = {"url": url, "raw": {}}

    # ── Extract fields ──────────────────────────────────────────────────────
    # Item Name / SKU
    sku_m = re.search(r'Item Name[^:]*:.*?<strong>([^<]+)</strong>', html, re.I | re.DOTALL)
    if sku_m:
        result["websiteSku"] = sku_m.group(1).strip()

    # Item Description
    desc_m = re.search(r'Item Description[^:]*:.*?<.*?>(.*?)</p>', html, re.I | re.DOTALL)
    if desc_m:
        result["itemDescription"] = strip_tags(desc_m.group(1))
    else:
        # Fallback — look for common description paragraph
        desc_m2 = re.search(r'Cylinder design[^<]{10,200}', html, re.I)
        if desc_m2:
            result["itemDescription"] = desc_m2.group(0).strip()

    # Item Type
    type_m = re.search(r'Item Type[^:]*:.*?<.*?>(.*?)</p>', html, re.I | re.DOTALL)
    if type_m:
        result["itemType"] = strip_tags(type_m.group(1))

    # Neck Thread Size
    thread_m = re.search(r'Neck Thread Size[^:]*:.*?<strong>([^<]+)</strong>', html, re.I | re.DOTALL)
    if thread_m:
        result["neckThreadSize"] = thread_m.group(1).strip()

    # Price
    price_m = re.search(r'\$\s*([\d.]+)\s*/pc', html)
    if price_m:
        result["webPrice1pc"] = float(price_m.group(1))

    # Height with Cap
    hwc_m = re.search(r'Height with Cap[^:]*:.*?<strong>([^<]+)</strong>', html, re.I | re.DOTALL)
    if hwc_m:
        result["heightWithCap"] = hwc_m.group(1).strip()

    # Capacity
    cap_m = re.search(r'Item Capacity[^:]*:.*?<strong>([^<]+)</strong>', html, re.I | re.DOTALL)
    if cap_m:
        result["capacity"] = cap_m.group(1).strip()

    # ── Classify component type from description + URL ──────────────────────
    desc = (result.get("itemDescription") or "").lower()
    url_slug = url.lower()

    # NOTE: These are BOTTLE products (glass bottle + applicator bundle)
    # On the new site, the applicator becomes selectable as a component
    is_bottle = "glass bottle" in desc

    # Determine the applicator/component type
    if "plastic roller ball" in desc or "plastic roller ball" in url_slug:
        result["componentType"] = "Plastic Roller"
        result["ballMaterial"] = "plastic"
    elif "metal roller ball" in desc or "metal roller ball" in url_slug:
        result["componentType"] = "Metal Roller"
        result["ballMaterial"] = "metal"
    elif "fine mist sprayer" in desc or "sprayer" in url_slug:
        result["componentType"] = "Sprayer"
    elif "lotion pump" in desc:
        result["componentType"] = "Lotion Pump"
    else:
        result["componentType"] = "Unknown"

    # Extract cap/trim color from description
    # e.g., "plastic roller ball plug and shiny gold cap"
    color_m = re.search(
        r'(?:roller ball plug|sprayer|pump)\s+(?:and\s+)?([a-z\s]+?)\s+(?:cap|trim)',
        desc, re.I
    )
    if color_m:
        result["capColor"] = color_m.group(1).strip().title()
    else:
        # Extract from URL slug
        slug_parts = url.rstrip('/').split('/')[-1].replace('-', ' ')
        # Remove known prefixes
        for prefix in ['cylinder design 9 ml clear glass bottle', 'plastic roller ball',
                        'metal roller ball', 'sprayer']:
            slug_parts = slug_parts.replace(prefix, '').strip()
        slug_parts = slug_parts.replace('cap', '').replace('trim and', '').strip()
        if slug_parts:
            result["capColor"] = slug_parts.title()

    result["isCurrentlyBundle"] = is_bottle
    result["futureComponentType"] = result["componentType"]  # for new site

    return result

# ── Run scrape ────────────────────────────────────────────────────────────────
all_urls = [
    ("Sprayer",        url) for url in SPRAYER_URLS
] + [
    ("Plastic Roller", url) for url in PLASTIC_ROLLER_URLS
] + [
    ("Metal Roller",   url) for url in METAL_ROLLER_URLS
]

results = []
not_found = []

print(f"Scraping {len(all_urls)} URLs for 17-415 components...\n")
print(f"{'Type':<18} {'Status':<10} {'SKU':<35} {'Thread':<10} {'Color':<20} {'Price'}")
print("-" * 110)

for comp_type, url in all_urls:
    html, final_url = fetch(url)
    time.sleep(0.5)  # Be polite

    if html is None:
        status = f"ERROR: {final_url}"
        print(f"  {comp_type:<16} ❌ {status[:60]}")
        not_found.append({"type": comp_type, "url": url, "error": final_url})
        continue

    # Check if redirected to homepage (JS-rendered product pages return homepage)
    if "bestbottles.com/product/" not in final_url:
        print(f"  {comp_type:<16} ⚠️  Redirected — page may be JS-rendered: {url.split('/')[-1][:40]}")
        not_found.append({"type": comp_type, "url": url, "note": "js_rendered"})
        continue

    parsed = parse_product_page(html, url)
    sku = parsed.get("websiteSku", "?")
    thread = parsed.get("neckThreadSize", "?")
    color = parsed.get("capColor", "?")
    price = parsed.get("webPrice1pc", "?")

    status = "✅" if sku != "?" and thread == "17-415" else "⚠️"
    print(f"  {comp_type:<16} {status}  {sku:<33} {str(thread):<10} {str(color):<20} ${price}")

    parsed["expectedType"] = comp_type
    results.append(parsed)

# Save
with open("data/scraped_17415_components.json", "w") as f:
    json.dump({"results": results, "not_found": not_found}, f, indent=2)

print(f"\n{'='*60}")
print(f"Scraped: {len(results)} pages processed")
print(f"Issues:  {len(not_found)} not found / redirected")
print(f"Saved:   data/scraped_17415_components.json")
