#!/usr/bin/env python3
"""
Best Bottles — Website Cross-Check Scraper
==========================================
Reads product data from grace_products_clean.json (source of Convex data),
scrapes the live bestbottles.com product pages, and compares the two.

Flags any spec that doesn't match. Outputs a structured JSON report.

Usage:
    /tmp/bbvenv/bin/python3 scripts/scrape_crosscheck.py
    /tmp/bbvenv/bin/python3 scripts/scrape_crosscheck.py --family "Cap"
    /tmp/bbvenv/bin/python3 scripts/scrape_crosscheck.py --family "Roll-On Cap"
    /tmp/bbvenv/bin/python3 scripts/scrape_crosscheck.py --all-caps
    /tmp/bbvenv/bin/python3 scripts/scrape_crosscheck.py --limit 20

Source of truth: bestbottles.com product pages
Fields compared: capacity, heightWithCap, heightWithoutCap, diameter,
                 neckThreadSize, webPrice1pc, webPrice12pc
New fields captured: width, depth, closureType, itemType
"""

import json
import re
import time
import argparse
import sys
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ Run with: /tmp/bbvenv/bin/python3 scripts/scrape_crosscheck.py")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA_FILE = ROOT / "data" / "grace_products_clean.json"
REPORT_FILE = ROOT / "docs" / "crosscheck_report.json"
DELAY_SECONDS = 1.2  # polite delay between requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

# All known spec labels on the website (order matters for regex stop-pattern)
SPEC_LABELS = [
    "Item Type",
    "Item Name",
    "Item Description",
    "Item Capacity",
    "Item Height with Cap",
    "Item Height without Cap",
    "Item Diameter",
    "Item Width",
    "Item Depth",
    "Neck Thread Size",
    "Closure Type",
]

# Build the alternation stop pattern once
STOP_PATTERN = "|".join(re.escape(l) for l in SPEC_LABELS)

# Mapping from website label → our Convex field name
LABEL_TO_FIELD = {
    "Item Capacity":            "capacity",
    "Item Height with Cap":     "heightWithCap",
    "Item Height without Cap":  "heightWithoutCap",
    "Item Diameter":            "diameter",
    "Item Width":               "width",
    "Item Depth":               "depth",
    "Neck Thread Size":         "neckThreadSize",
    "Closure Type":             "closureType",
    "Item Type":                "itemType",
    "Item Name":                "itemName",
    "Item Description":         "itemDescription",
}


def extract_specs(full_text: str) -> dict:
    """Extract all spec fields from raw page text using regex."""
    data = {}
    for label in SPEC_LABELS:
        pattern = (
            rf'{re.escape(label)}:\s*'
            rf'(.+?)'
            rf'(?=(?:{STOP_PATTERN})\:|1\s*pcs?\s*[-–]|\Z)'
        )
        m = re.search(pattern, full_text, re.IGNORECASE | re.DOTALL)
        if m:
            value = re.sub(r'\s+', ' ', m.group(1)).strip()
            # Strip trailing "Purchase:" or copyright noise
            value = re.sub(r'\s*Purchase:.*$', '', value, flags=re.IGNORECASE).strip()
            value = re.sub(r'\s*Nemat International.*$', '', value, flags=re.IGNORECASE).strip()
            field = LABEL_TO_FIELD.get(label, label.lower().replace(" ", "_"))
            if value:
                data[field] = value
    return data


def scrape_product_page(url: str) -> dict | None:
    """Scrape a single bestbottles.com product page and return extracted fields."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code == 404:
            return {"error": "404 — page not found"}
        if resp.status_code != 200:
            return {"error": f"HTTP {resp.status_code}"}

        soup = BeautifulSoup(resp.text, "html.parser")
        full_text = soup.get_text(" ")

        data = {"url": url, "scraped_ok": True}
        data.update(extract_specs(full_text))

        # ── Pricing ───────────────────────────────────────────────────────────
        price_m = re.search(r'1\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*/\s*pc', full_text, re.I)
        if price_m:
            data["webPrice1pc_scraped"] = float(price_m.group(1))

        dozen_m = re.search(r'12\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*/\s*pc', full_text, re.I)
        if dozen_m:
            data["webPrice12pc_scraped"] = float(dozen_m.group(1))

        return data

    except requests.exceptions.ConnectionError:
        return {"error": "Connection failed — site unreachable"}
    except requests.exceptions.Timeout:
        return {"error": "Timeout"}
    except Exception as e:
        return {"error": str(e)}


def normalize(s: str | None) -> str | None:
    """Normalize a spec value for comparison by removing tolerance ranges and extra whitespace."""
    if s is None:
        return None
    s = str(s).strip()
    s = re.sub(r'\s*±\s*[\d.]+\s*mm', '', s)   # strip ±0.5 mm tolerance
    s = re.sub(r'\s*±\s*[\d.]+\s*mm', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip().lower()


def compare_field(convex_val, scraped_val) -> dict:
    """Compare a single field value. Returns status + both values."""
    c = str(convex_val).strip() if convex_val is not None else None
    s = str(scraped_val).strip() if scraped_val is not None else None

    if s is None:
        return {"status": "not_scraped", "convex": c, "scraped": None}
    if c is None:
        return {"status": "missing_in_convex", "convex": None, "scraped": s}
    if normalize(c) == normalize(s):
        return {"status": "match", "convex": c, "scraped": s}
    return {"status": "mismatch", "convex": c, "scraped": s}


COMPARE_MAP = {
    # convex field      : scraped field
    "capacity":          "capacity",
    "heightWithCap":     "heightWithCap",
    "heightWithoutCap":  "heightWithoutCap",
    "diameter":          "diameter",
    "neckThreadSize":    "neckThreadSize",
    "webPrice1pc":       "webPrice1pc_scraped",
    "webPrice12pc":      "webPrice12pc_scraped",
}


def run_crosscheck(products: list, limit: int | None = None) -> list:
    """Cross-check a list of products against the live website."""
    results = []
    total = min(len(products), limit) if limit else len(products)
    print(f"\n🔍 Cross-checking {total} products against bestbottles.com...\n")

    for i, product in enumerate(products[:total]):
        sku = product.get("graceSku", "unknown")
        url = product.get("productUrl")
        print(f"  [{i+1:>3}/{total}] {sku:<40}", end="", flush=True)

        if not url or url == "-":
            print("⚠️  No URL — skipped")
            results.append({"graceSku": sku, "websiteSku": product.get("websiteSku"),
                             "family": product.get("family"), "url": None,
                             "status": "no_url", "fields": {}})
            continue

        scraped = scrape_product_page(url)
        time.sleep(DELAY_SECONDS)

        if not scraped or scraped.get("error"):
            err = scraped.get("error", "no response") if scraped else "no response"
            print(f"❌ {err}")
            results.append({"graceSku": sku, "websiteSku": product.get("websiteSku"),
                             "family": product.get("family"), "url": url,
                             "status": "scrape_error", "error": err, "fields": {}})
            continue

        # Compare fields
        field_results = {}
        has_mismatch = False
        has_missing = False
        for convex_field, scraped_field in COMPARE_MAP.items():
            cmp = compare_field(product.get(convex_field), scraped.get(scraped_field))
            field_results[convex_field] = cmp
            if cmp["status"] == "mismatch":
                has_mismatch = True
            if cmp["status"] == "missing_in_convex":
                has_missing = True

        # New fields discovered on website not in Convex schema
        new_fields = {f: scraped[f] for f in ["width", "depth", "closureType", "itemType"]
                      if scraped.get(f)}

        if has_mismatch:
            icon = "⚠️  MISMATCH"
        elif has_missing:
            icon = "➕ NEW DATA"
        else:
            icon = "✅ OK"
        print(icon)

        results.append({
            "graceSku": sku,
            "websiteSku": product.get("websiteSku"),
            "family": product.get("family"),
            "url": url,
            "status": "mismatch" if has_mismatch else ("new_data" if has_missing else "ok"),
            "scraped_description": scraped.get("itemDescription"),
            "scraped_itemType":    scraped.get("itemType"),
            "fields":              field_results,
            "new_fields_from_website": new_fields,
        })

    return results


def print_summary(results: list):
    ok       = sum(1 for r in results if r["status"] == "ok")
    mismatch = sum(1 for r in results if r["status"] == "mismatch")
    new_data = sum(1 for r in results if r["status"] == "new_data")
    errors   = sum(1 for r in results if r["status"] in ("scrape_error", "no_url"))
    total    = len(results)

    print(f"\n{'='*60}")
    print(f"CROSS-CHECK SUMMARY  ({total} products checked)")
    print(f"{'='*60}")
    print(f"  ✅ Fully matching:  {ok}")
    print(f"  ⚠️  Mismatches:     {mismatch}")
    print(f"  ➕ New data found:  {new_data}")
    print(f"  ❌ Errors/no URL:   {errors}")

    if mismatch > 0:
        print(f"\n{'─'*60}")
        print("MISMATCHES — WEBSITE IS SOURCE OF TRUTH, UPDATE CONVEX:")
        print(f"{'─'*60}")
        for r in results:
            if r["status"] == "mismatch":
                print(f"\n  SKU:  {r['graceSku']}")
                print(f"  URL:  {r['url']}")
                for field, cmp in r["fields"].items():
                    if cmp["status"] == "mismatch":
                        print(f"    ✏️  {field}")
                        print(f"        Convex:  '{cmp['convex']}'")
                        print(f"        Website: '{cmp['scraped']}'  ← USE THIS")

    new_field_hits = [r for r in results if r.get("new_fields_from_website")]
    if new_field_hits:
        print(f"\n{'─'*60}")
        print(f"NEW FIELDS FROM WEBSITE (to add to Convex schema):")
        print(f"{'─'*60}")
        all_new = {}
        for r in new_field_hits:
            for k, v in r["new_fields_from_website"].items():
                if k not in all_new:
                    all_new[k] = []
                all_new[k].append(f"{r['graceSku']}: {v}")
        for field, examples in all_new.items():
            print(f"  {field}: ({len(examples)} products)")
            for ex in examples[:3]:
                print(f"    {ex}")

    missing_in_convex = [(r["graceSku"], f, c["scraped"])
                         for r in results
                         for f, c in r.get("fields", {}).items()
                         if c["status"] == "missing_in_convex"]
    if missing_in_convex:
        print(f"\n{'─'*60}")
        print(f"FIELDS MISSING IN CONVEX (scraped from website):")
        for sku, field, val in missing_in_convex[:15]:
            print(f"  {sku} → {field} = '{val}'")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--family", help="Filter by family (e.g. 'Cap')")
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--all-caps", action="store_true")
    args = parser.parse_args()

    print("╔══════════════════════════════════════════════════════╗")
    print("║  Best Bottles — Website Cross-Check Scraper  v2     ║")
    print("║  Source of Truth: bestbottles.com                   ║")
    print("╚══════════════════════════════════════════════════════╝")

    with open(DATA_FILE) as f:
        all_products = json.load(f)

    if args.all_caps:
        products = [p for p in all_products
                    if p.get("family") in ["Cap", "Cap/Closure", "Roll-On Cap", "Dropper", "Sprayer"]]
        print(f"\n📦 {len(products)} cap-related products loaded")
    elif args.family:
        products = [p for p in all_products if p.get("family") == args.family]
        print(f"\n📦 {len(products)} '{args.family}' products loaded")
    else:
        products = [p for p in all_products
                    if p.get("family") in ["Cap", "Cap/Closure", "Roll-On Cap"]
                    and p.get("productUrl")]
        print(f"\n📦 {len(products)} cap products with URLs loaded")

    results = run_crosscheck(products, limit=args.limit)
    print_summary(results)

    report_path = ROOT / "docs" / f"crosscheck_report_{args.family.replace(' ', '_')}.json" if args.family else REPORT_FILE
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n💾 Report saved → docs/{report_path.name}\n")


if __name__ == "__main__":
    main()
