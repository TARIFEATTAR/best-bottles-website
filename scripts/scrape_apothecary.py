#!/usr/bin/env python3
"""
Scrape the Apothecary Style Bottles category page from bestbottles.com
and compare with our database / grace_products data.

Usage:
    python scripts/scrape_apothecary.py

Output:
    data/apothecary_scrape_report.json
"""

import json
import re
import sys
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ Install: pip install requests beautifulsoup4")
    sys.exit(1)

URL = "https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/apothecary-style-bottles.php"
ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / "data" / "apothecary_scrape_report.json"
GRACE_CSV = ROOT / "data" / "grace_products_final.csv"
FIRECRAWL = ROOT / "data" / "firecrawl_url_map.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


def scrape_category_page() -> list[dict]:
    """Fetch the apothecary category page and extract product cards."""
    resp = requests.get(URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    products = []
    # BestBottles category pages typically use product blocks with SKU in bold
    # Look for patterns like <strong>GB15ApthBlue</strong> or similar
    for strong in soup.find_all("strong"):
        sku = strong.get_text(strip=True)
        if not sku or len(sku) < 8:
            continue
        # Apothecary SKUs: GB15ApthBlue, GB1ozApth, GBPearClear4ozStpr, GBRndClear4ozStpr
        if not re.match(r"^GB[A-Za-z0-9]+$", sku):
            continue

        # Get description from next sibling or parent
        desc = ""
        parent = strong.parent
        if parent:
            for sib in parent.find_next_siblings():
                text = sib.get_text(separator=" ", strip=True)
                if text and not re.match(r"^(Pack Of|Qty|Add to|Out Of Stock|Total|Price)", text):
                    desc = text[:200]
                    break
            if not desc and parent.parent:
                text = parent.parent.get_text(separator=" ", strip=True)
                if "Apothecary" in text or "glass" in text.lower():
                    desc = re.sub(rf"^{re.escape(sku)}\s*", "", text)[:200]

        # Check for Out of Stock
        block = strong.find_parent("div", class_=re.compile(r"product|item|card", re.I))
        if not block:
            block = strong.find_parent("div", recursive=True)
        block_text = block.get_text() if block else ""
        out_of_stock = "Out Of Stock" in block_text or "Out of Stock" in block_text

        products.append({
            "websiteSku": sku,
            "description": desc,
            "outOfStock": out_of_stock,
            "source": "live_category_page",
        })

    # Dedupe by SKU
    seen = set()
    unique = []
    for p in products:
        if p["websiteSku"] not in seen:
            seen.add(p["websiteSku"])
            unique.append(p)

    return unique


def load_grace_apothecary() -> list[dict]:
    """Load Apothecary products from grace_products_final.csv."""
    if not GRACE_CSV.exists():
        return []
    rows = []
    with open(GRACE_CSV) as f:
        for i, line in enumerate(f):
            if i == 0:
                continue  # header
            parts = line.strip().split(",")
            if len(parts) < 6:
                continue
            family = parts[4] if len(parts) > 4 else ""
            if family.lower() != "apothecary":
                continue
            rows.append({
                "websiteSku": parts[2] if len(parts) > 2 else "",
                "graceSku": parts[1] if len(parts) > 1 else "",
                "family": family,
                "capacity": parts[5] if len(parts) > 5 else "",
            })
    return rows


def load_firecrawl_apothecary() -> list[str]:
    """Get all apothecary-style URLs from firecrawl map."""
    if not FIRECRAWL.exists():
        return []
    with open(FIRECRAWL) as f:
        data = json.load(f)
    urls = []
    for link in data.get("links", []):
        url = link.get("url", "")
        if "apothecary" in url.lower() or "Apothecary" in str(link):
            urls.append(url)
    return urls


def main():
    print("Scraping apothecary category page...")
    live = scrape_category_page()
    print(f"  Found {len(live)} products on live page")

    grace = load_grace_apothecary()
    print(f"  Found {len(grace)} Apothecary products in grace_products_final.csv")

    firecrawl_urls = load_firecrawl_apothecary()
    print(f"  Found {len(firecrawl_urls)} apothecary-style URLs in firecrawl map")

    grace_skus = {r["websiteSku"].lower(): r for r in grace}
    live_skus = {p["websiteSku"].lower() for p in live}

    in_both = []
    in_live_only = []
    in_grace_only = []

    for p in live:
        sku_lower = p["websiteSku"].lower()
        if sku_lower in grace_skus:
            in_both.append({**p, "graceSku": grace_skus[sku_lower].get("graceSku")})
        else:
            in_live_only.append(p)

    for sku, r in grace_skus.items():
        if sku not in live_skus:
            in_grace_only.append(r)

    report = {
        "sourceUrl": URL,
        "scrapedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "livePage": {
            "productCount": len(live),
            "products": live,
        },
        "ourDatabase": {
            "apothecaryFamilyCount": len(grace),
            "products": grace,
        },
        "firecrawl": {
            "apothecaryStyleUrlCount": len(firecrawl_urls),
            "urls": firecrawl_urls[:30],
        },
        "gapAnalysis": {
            "inBoth": in_both,
            "inLiveOnlyMissingFromUs": in_live_only,
            "inUsOnlyNotOnCategoryPage": in_grace_only,
            "summary": {
                "liveTotal": len(live),
                "ourApothecaryTotal": len(grace),
                "missingFromUs": len(in_live_only),
                "extraInUs": len(in_grace_only),
            },
        },
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport written to {OUTPUT}")
    print("\n--- Gap Summary ---")
    print(f"  Live page products: {len(live)}")
    print(f"  Our Apothecary family: {len(grace)}")
    print(f"  Missing from our DB (on live page): {len(in_live_only)}")
    if in_live_only:
        for p in in_live_only:
            print(f"    - {p['websiteSku']} {p.get('description', '')[:50]}...")
    print(f"  In our DB but not on this category page: {len(in_grace_only)}")


if __name__ == "__main__":
    main()
