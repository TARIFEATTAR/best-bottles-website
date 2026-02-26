#!/usr/bin/env python3
"""
GLOBAL PRICING AUDIT — Best Bottles Product Catalog
====================================================
Crawls every product URL in grace_products_clean.json,
scrapes the live price from bestbottles.com, and compares
it against our stored price. Generates a comprehensive
discrepancy report.

Usage:
    python3 scripts/pricing_audit.py

Output:
    data/pricing_audit_report.json    — Full machine-readable report
    data/pricing_audit_summary.csv    — Human-readable summary for Excel
"""

import json
import re
import csv
import time
import sys
import os
from datetime import datetime

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install requests beautifulsoup4")
    sys.exit(1)

# ─── Configuration ────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, "data", "grace_products_clean.json")
REPORT_JSON = os.path.join(ROOT, "data", "pricing_audit_report.json")
REPORT_CSV = os.path.join(ROOT, "data", "pricing_audit_summary.csv")

REQUEST_DELAY = 2.0  # seconds between requests (polite crawling)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

# Price tolerance: differences smaller than this are ignored (rounding)
PRICE_TOLERANCE = 0.02  # $0.02

# ─── Price Scraping ───────────────────────────────────────────────────
def scrape_prices(url):
    """
    Scrape pricing from a bestbottles.com product page.
    Returns dict with price tiers found, or None on failure.
    """
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        return {"error": str(e)}

    soup = BeautifulSoup(resp.text, "html.parser")
    
    prices = {}
    
    # Strategy 1: Look for price in structured pricing table/divs
    # bestbottles.com typically has pricing tiers in the page
    page_text = soup.get_text(" ", strip=True)
    
    # Pattern: "$X.XX/pc" or "$X.XX /pc" for 1pc price
    # Pattern: "1 pcs - $X.XX/pc" or "1 pc - $X.XX"
    one_pc_patterns = [
        r'1\s*pcs?\s*[-–]\s*\$(\d+\.?\d*)\s*/?\s*pc',
        r'1\s*pcs?\s*[-–]\s*\$(\d+\.?\d*)',
        r'Price:\s*\$(\d+\.?\d*)',
    ]
    
    for pat in one_pc_patterns:
        m = re.search(pat, page_text, re.IGNORECASE)
        if m:
            prices['live_price_1pc'] = float(m.group(1))
            break
    
    # Pattern: "12 pcs - $XX.XX ($X.XX/pc)"
    twelve_pc_patterns = [
        r'12\s*pcs?\s*[-–]\s*\$[\d,]+\.?\d*\s*\(\$(\d+\.?\d*)\s*/?\s*pc\)',
        r'12\s*pcs?\s*[-–]\s*\$(\d+\.?\d*)',
    ]
    
    for pat in twelve_pc_patterns:
        m = re.search(pat, page_text, re.IGNORECASE)
        if m:
            prices['live_price_12pc'] = float(m.group(1))
            break
    
    # Also grab ALL price tiers for reference
    all_tiers = re.findall(r'(\d+)\s*pcs?\s*[-–]\s*\$([\d,]+\.?\d*)\s*(?:\(\$([\d.]+)/pc\))?', page_text, re.IGNORECASE)
    if all_tiers:
        tiers = {}
        for qty, total, per_pc in all_tiers:
            tiers[f"{qty}pc"] = {
                "total": float(total.replace(",", "")),
                "per_pc": float(per_pc) if per_pc else None
            }
        prices['all_tiers'] = tiers
    
    # Fallback: search for any dollar amount pattern in common price containers
    if 'live_price_1pc' not in prices:
        # Try meta tags or structured data
        for meta in soup.find_all("meta", {"property": "product:price:amount"}):
            try:
                prices['live_price_1pc'] = float(meta.get("content", "0"))
                break
            except ValueError:
                pass
    
    if 'live_price_1pc' not in prices:
        # Try finding price in specific CSS classes common to e-commerce
        for cls in ['price', 'product-price', 'current-price', 'sale-price']:
            el = soup.find(class_=re.compile(cls, re.I))
            if el:
                m = re.search(r'\$(\d+\.?\d*)', el.get_text())
                if m:
                    prices['live_price_1pc'] = float(m.group(1))
                    break
    
    # Also extract the SKU/product name from the page for verification
    title_tag = soup.find("title")
    if title_tag:
        prices['page_title'] = title_tag.get_text(strip=True)[:100]
    
    # Extract stock status if visible
    stock_text = page_text.lower()
    if 'out of stock' in stock_text:
        prices['live_stock'] = 'Out of Stock'
    elif 'in stock' in stock_text:
        prices['live_stock'] = 'In Stock'
    elif 'back order' in stock_text or 'backorder' in stock_text:
        prices['live_stock'] = 'Back Order'
    
    return prices


# ─── Main Audit Loop ─────────────────────────────────────────────────
def main():
    print("=" * 64)
    print("  GLOBAL PRICING AUDIT — Best Bottles Catalog")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 64)
    
    with open(DATA_FILE) as f:
        products = json.load(f)
    
    total = len(products)
    with_url = [p for p in products if p.get("productUrl")]
    no_url = [p for p in products if not p.get("productUrl")]
    
    print(f"\n  Total products:     {total}")
    print(f"  With URL (will check): {len(with_url)}")
    print(f"  No URL (skip):      {len(no_url)}")
    estimated_mins = (len(with_url) * REQUEST_DELAY) / 60
    print(f"  Est. time:          ~{estimated_mins:.0f} minutes")
    print(f"  Delay between reqs: {REQUEST_DELAY}s")
    print("=" * 64)
    
    results = []
    stats = {
        "total_checked": 0,
        "matches": 0,
        "mismatches_1pc": 0,
        "mismatches_12pc": 0,
        "errors": 0,
        "no_price_found": 0,
        "no_url": len(no_url),
    }
    
    for idx, product in enumerate(with_url):
        sku = product.get("graceSku", "???")
        url = product.get("productUrl")
        stored_1pc = product.get("webPrice1pc")
        stored_12pc = product.get("webPrice12pc")
        family = product.get("family", "Unknown")
        
        # Progress
        pct = (idx + 1) / len(with_url) * 100
        sys.stdout.write(f"\r  [{idx+1:4d}/{len(with_url)}] {pct:5.1f}%  {sku:35s}")
        sys.stdout.flush()
        
        # Scrape
        scraped = scrape_prices(url)
        stats["total_checked"] += 1
        
        if not scraped or "error" in scraped:
            error_msg = scraped.get("error", "Unknown error") if scraped else "No response"
            results.append({
                "graceSku": sku,
                "family": family,
                "url": url,
                "status": "ERROR",
                "error": error_msg,
                "stored_1pc": stored_1pc,
                "stored_12pc": stored_12pc,
            })
            stats["errors"] += 1
            time.sleep(REQUEST_DELAY)
            continue
        
        live_1pc = scraped.get("live_price_1pc")
        live_12pc = scraped.get("live_price_12pc")
        
        if live_1pc is None:
            results.append({
                "graceSku": sku,
                "family": family,
                "url": url,
                "status": "NO_PRICE_FOUND",
                "stored_1pc": stored_1pc,
                "stored_12pc": stored_12pc,
                "scraped_raw": scraped,
            })
            stats["no_price_found"] += 1
            time.sleep(REQUEST_DELAY)
            continue
        
        # Compare prices
        mismatch_1pc = False
        mismatch_12pc = False
        diff_1pc = 0
        diff_12pc = 0
        
        if stored_1pc is not None:
            try:
                diff_1pc = abs(float(stored_1pc) - live_1pc)
                mismatch_1pc = diff_1pc > PRICE_TOLERANCE
            except (ValueError, TypeError):
                mismatch_1pc = True
                diff_1pc = -1
        
        if stored_12pc is not None and live_12pc is not None:
            try:
                diff_12pc = abs(float(stored_12pc) - live_12pc)
                mismatch_12pc = diff_12pc > PRICE_TOLERANCE
            except (ValueError, TypeError):
                mismatch_12pc = True
                diff_12pc = -1
        
        status = "MATCH"
        if mismatch_1pc:
            status = "MISMATCH_1PC"
            stats["mismatches_1pc"] += 1
        if mismatch_12pc:
            if status == "MISMATCH_1PC":
                status = "MISMATCH_BOTH"
            else:
                status = "MISMATCH_12PC"
            stats["mismatches_12pc"] += 1
        
        if status == "MATCH":
            stats["matches"] += 1
        
        results.append({
            "graceSku": sku,
            "family": family,
            "url": url,
            "status": status,
            "stored_1pc": stored_1pc,
            "live_1pc": live_1pc,
            "diff_1pc": round(diff_1pc, 2),
            "stored_12pc": stored_12pc,
            "live_12pc": live_12pc,
            "diff_12pc": round(diff_12pc, 2),
            "live_stock": scraped.get("live_stock"),
            "all_tiers": scraped.get("all_tiers"),
        })
        
        time.sleep(REQUEST_DELAY)
    
    # ─── Generate Reports ─────────────────────────────────────────────
    print("\n\n" + "=" * 64)
    print("  AUDIT COMPLETE")
    print("=" * 64)
    print(f"  Products checked:    {stats['total_checked']}")
    print(f"  ✅ Price matches:    {stats['matches']}")
    print(f"  ⚠️  1pc mismatches:  {stats['mismatches_1pc']}")
    print(f"  ⚠️  12pc mismatches: {stats['mismatches_12pc']}")
    print(f"  ❌ Errors:           {stats['errors']}")
    print(f"  🔍 No price found:   {stats['no_price_found']}")
    print(f"  📭 No URL (skipped): {stats['no_url']}")
    print("=" * 64)
    
    # Save JSON report
    report = {
        "audit_date": datetime.now().isoformat(),
        "stats": stats,
        "results": results,
    }
    with open(REPORT_JSON, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  💾 JSON report → {REPORT_JSON}")
    
    # Save CSV summary (only mismatches + errors for quick review)
    csv_cols = [
        "status", "graceSku", "family",
        "stored_1pc", "live_1pc", "diff_1pc",
        "stored_12pc", "live_12pc", "diff_12pc",
        "live_stock", "url"
    ]
    with open(REPORT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=csv_cols, extrasaction="ignore")
        writer.writeheader()
        # Write mismatches first, then errors, then no_price, then matches
        for status_order in ["MISMATCH_BOTH", "MISMATCH_1PC", "MISMATCH_12PC", "ERROR", "NO_PRICE_FOUND", "MATCH"]:
            for r in results:
                if r.get("status") == status_order:
                    writer.writerow(r)
    print(f"  📊 CSV summary  → {REPORT_CSV}")
    
    # Print worst offenders
    mismatches = [r for r in results if "MISMATCH" in r.get("status", "")]
    if mismatches:
        mismatches.sort(key=lambda x: abs(x.get("diff_1pc", 0) or 0), reverse=True)
        print(f"\n  TOP PRICE DISCREPANCIES (1pc price):")
        for m in mismatches[:20]:
            stored = m.get("stored_1pc", "?")
            live = m.get("live_1pc", "?")
            diff = m.get("diff_1pc", 0)
            print(f"    {m['graceSku']:35s}  DB: ${stored}  →  LIVE: ${live}  (Δ ${diff})")
    
    print(f"\n  Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 64)


if __name__ == "__main__":
    main()
