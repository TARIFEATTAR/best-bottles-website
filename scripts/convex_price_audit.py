#!/usr/bin/env python3
"""
convex_price_audit.py
─────────────────────
Cross-references every SKU in the live Convex database against
bestbottles.com and identifies price mismatches for:
  • webPrice1pc   (1-piece price — on all products)
  • webPrice12pc  (12-piece price — on most glass bottles)
  • webPrice10pc  (10-piece price — on ~70 packaging/accessory items)

Outputs:
  data/convex_price_audit_<date>.csv    — spreadsheet (mismatches first)
  data/convex_price_audit_<date>.json   — machine-readable full report
  data/price_patches_<date>.ts          — paste into convex/migrations.ts
                                          then run applyPricePatches from dashboard

Usage:
  python3 scripts/convex_price_audit.py              # full audit
  python3 scripts/convex_price_audit.py --family Elegant
  python3 scripts/convex_price_audit.py --limit 50   # quick test run

Requirements:
  pip install requests beautifulsoup4
"""

import json, csv, time, sys, os, re, argparse
from datetime import datetime
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing: pip install requests beautifulsoup4")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────

CONVEX_URL = (
    os.environ.get("NEXT_PUBLIC_CONVEX_URL")
    or os.environ.get("CONVEX_URL")
    or "https://helpful-elephant-638.convex.cloud"
)
REQUEST_DELAY   = 0.9    # seconds — be polite to bestbottles.com
PRICE_TOLERANCE = 0.03   # ≤$0.03 diff treated as rounding, not a mismatch

TS          = datetime.now().strftime("%Y%m%d_%H%M")
REPORT_JSON = Path(f"data/convex_price_audit_{TS}.json")
REPORT_CSV  = Path(f"data/convex_price_audit_{TS}.csv")
PATCH_TS    = Path(f"data/price_patches_{TS}.ts")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Step 1 — Load products from Convex or local fallback ─────────────────────

def load_products(convex_url: str) -> list[dict]:
    """
    Tries to load from live Convex REST API (paginated).
    Falls back to local grace_products_clean.json if Convex returns 0 or errors.
    The local file is kept in sync with Convex via the upload scripts.
    """
    endpoint = f"{convex_url.rstrip('/')}/api/query"
    batch    = 500
    skip     = 0
    all_prods: list[dict] = []
    total    = None

    try:
        while True:
            r = requests.post(endpoint, json={
                "path": "products:getAllForAudit",
                "args": {"limit": batch, "skip": skip}
            }, timeout=30)
            if r.status_code != 200:
                raise Exception(f"HTTP {r.status_code}: {r.text[:200]}")
            data = r.json()
            val  = data.get("value", {})
            if total is None:
                total = val.get("total", 0)
            page = val.get("page", [])
            if not page:
                break
            all_prods.extend(page)
            print(f"     Loaded {len(all_prods)}/{total}...", end="\r")
            if len(all_prods) >= (total or 0):
                break
            skip += batch

        if all_prods:
            print(f"  ✅ {len(all_prods)} products loaded from live Convex          ")
            return all_prods
        else:
            print(f"  ⚠️  Convex returned 0 products (query limit). Using local file...")
    except Exception as e:
        print(f"  ⚠️  Convex REST failed: {e}\n     Using local file...")

    # Local fallback — kept in sync with Convex via batch upload scripts
    for p in ["data/grace_products_clean.json", "data/grace_products_final.json", "data/grace_products.json"]:
        if Path(p).exists():
            prods = json.load(open(p))
            print(f"  ✅ {len(prods)} products loaded from {p}")
            return prods

    print("  ❌ No product source found. Exiting.")
    sys.exit(1)


# ── Step 2 — Scrape live pricing tiers from bestbottles.com ──────────────────

def scrape_prices(url: str) -> dict:
    """
    Returns a dict with keys: live_1pc, live_10pc, live_12pc, all_tiers, live_stock.
    all_tiers maps qty string → price float, e.g. {"1": 0.80, "12": 0.65, "10": 0.70}.
    """
    result = {}
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        if resp.status_code == 404:
            return {"error": "404"}
        if resp.status_code != 200:
            return {"error": f"HTTP {resp.status_code}"}

        soup = BeautifulSoup(resp.text, "html.parser")
        raw  = resp.text

        # ── A: Price tier table (primary strategy) ────────────────────────
        # bestbottles.com product pages have a pricing table with qty rows
        # Structure: <td>1 Piece</td> ... <td>$0.80</td>
        tier_map: dict[str, float] = {}
        for row in soup.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2:
                qty_text   = cells[0].get_text(strip=True)
                price_text = cells[-1].get_text(strip=True)
                qty_m   = re.search(r"(\d+)", qty_text)
                price_m = re.search(r"\$([\d]+\.[\d]{2})", price_text)
                if qty_m and price_m:
                    qty   = int(qty_m.group(1))
                    price = float(price_m.group(1))
                    tier_map[str(qty)] = price

        if tier_map:
            result["all_tiers"] = tier_map
            # 1-piece: lowest qty key
            min_qty = min(int(k) for k in tier_map)
            result["live_1pc"] = tier_map[str(min_qty)]
            # 10-piece
            if "10" in tier_map:
                result["live_10pc"] = tier_map["10"]
            # 12-piece
            if "12" in tier_map:
                result["live_12pc"] = tier_map["12"]
            # Handle cases where the lowest tier IS 10 or 12 (no 1pc)
            # — treat it as 1pc for comparison purposes
            if "live_1pc" not in result and tier_map:
                result["live_1pc"] = tier_map[str(min(int(k) for k in tier_map))]

        # ── B: JSON-LD schema.org offers (fallback) ───────────────────────
        if "live_1pc" not in result:
            for script in soup.find_all("script", type="application/ld+json"):
                try:
                    ld = json.loads(script.string or "")
                    offers = ld.get("offers") or ld.get("Offers")
                    if isinstance(offers, dict):
                        p = offers.get("price") or offers.get("lowPrice")
                        if p: result["live_1pc"] = float(p); break
                    elif isinstance(offers, list) and offers:
                        p = offers[0].get("price")
                        if p: result["live_1pc"] = float(p); break
                except Exception:
                    pass

        # ── C: meta itemprop="price" (fallback) ───────────────────────────
        if "live_1pc" not in result:
            meta = soup.find("meta", itemprop="price")
            if meta:
                try: result["live_1pc"] = float(meta.get("content", ""))
                except ValueError: pass

        # ── D: Scan all dollar amounts (last resort) ───────────────────────
        if "live_1pc" not in result:
            prices = [float(m) for m in re.findall(r"\$([\d]+\.[\d]{2})", raw)
                      if 0.01 < float(m) < 200]
            if prices:
                result["live_1pc"] = min(prices)

        # Stock status
        lc = raw.lower()
        if "out of stock" in lc:          result["live_stock"] = "Out of Stock"
        elif "back order" in lc or "backorder" in lc: result["live_stock"] = "Back Order"
        else:                             result["live_stock"] = "In Stock"

    except Exception as ex:
        return {"error": str(ex)}

    return result

# ── Step 3 — Compare one product ─────────────────────────────────────────────

def audit_product(p: dict) -> dict:
    sku      = p.get("graceSku") or p.get("grace_sku") or "???"
    url      = p.get("productUrl") or p.get("product_url") or ""
    s1pc     = p.get("webPrice1pc")
    s10pc    = p.get("webPrice10pc")
    s12pc    = p.get("webPrice12pc")
    family   = p.get("family") or "?"
    name     = (p.get("itemName") or p.get("item_name") or "")[:90]

    base = {"graceSku": sku, "family": family, "itemName": name, "url": url,
            "stored_1pc": s1pc, "stored_10pc": s10pc, "stored_12pc": s12pc}

    if not url:
        return {**base, "status": "NO_URL"}

    sc = scrape_prices(url)
    if "error" in sc:
        return {**base, "status": f"ERROR_{sc['error']}", "live_1pc": None}

    l1pc  = sc.get("live_1pc")
    l10pc = sc.get("live_10pc")
    l12pc = sc.get("live_12pc")

    if l1pc is None:
        return {**base, "status": "NO_PRICE_FOUND",
                "live_1pc": None, "live_10pc": l10pc, "live_12pc": l12pc,
                "live_stock": sc.get("live_stock"), "all_tiers": sc.get("all_tiers")}

    def compare(stored, live):
        if stored is None or live is None:
            return 0.0, False
        diff = round(abs(float(stored) - float(live)), 4)
        return diff, diff > PRICE_TOLERANCE

    d1, m1   = compare(s1pc,  l1pc)
    d10, m10 = compare(s10pc, l10pc)
    d12, m12 = compare(s12pc, l12pc)

    # Determine status — any mismatch in any tier counts
    if (m1 and m12) or (m1 and m10):
        status = "MISMATCH_BOTH"
    elif m1:
        status = "MISMATCH_1PC"
    elif m12:
        status = "MISMATCH_12PC"
    elif m10:
        status = "MISMATCH_10PC"
    else:
        status = "MATCH"

    return {
        **base, "status": status,
        "live_1pc": l1pc,   "diff_1pc": d1,
        "live_10pc": l10pc, "diff_10pc": d10,
        "live_12pc": l12pc, "diff_12pc": d12,
        "live_stock": sc.get("live_stock"),
        "all_tiers": sc.get("all_tiers"),
    }

# ── Step 4 — Generate Convex migration patch ──────────────────────────────────

def write_patch_file(mismatches: list[dict], path: Path) -> None:
    """Writes a TypeScript patch list + a Convex mutation to apply it."""
    now = datetime.now().isoformat()
    patches_js = []
    for m in mismatches:
        fields = [f'  graceSku: {json.dumps(m["graceSku"])},']
        if m.get("live_1pc")  is not None: fields.append(f'  webPrice1pc:  {m["live_1pc"]},   // was: {m.get("stored_1pc")}')
        if m.get("live_10pc") is not None: fields.append(f'  webPrice10pc: {m["live_10pc"]},  // was: {m.get("stored_10pc")}')
        if m.get("live_12pc") is not None: fields.append(f'  webPrice12pc: {m["live_12pc"]},  // was: {m.get("stored_12pc")}')
        patches_js.append("{\n" + "\n".join(fields) + "\n}")

    content = f"""// AUTO-GENERATED — DO NOT EDIT BY HAND
// Source: scripts/convex_price_audit.py
// Generated: {now}
// Total patches: {len(mismatches)}
//
// ─── INSTRUCTIONS ───────────────────────────────────────────────────────────
// 1. Open convex/migrations.ts
// 2. Add this import at the top (if not already present):
//      import {{ PRICE_PATCHES_{TS} }} from "../data/price_patches_{TS}";
// 3. Copy the applyPricePatches_{TS} mutation below into convex/migrations.ts
// 4. Run: npx convex run migrations:applyPricePatches_{TS} --prod
// ─────────────────────────────────────────────────────────────────────────────

export const PRICE_PATCHES_{TS} = [
  {(",\n  ").join(patches_js)},
];

// ─── Paste into convex/migrations.ts ────────────────────────────────────────
/*
import {{ mutation }} from "./_generated/server";
import {{ PRICE_PATCHES_{TS} }} from "../data/price_patches_{TS}";

export const applyPricePatches_{TS} = mutation({{
  args: {{}},
  handler: async (ctx) => {{
    let updated = 0, notFound = 0;
    for (const patch of PRICE_PATCHES_{TS}) {{
      const doc = await ctx.db
        .query("products")
        .withIndex("by_graceSku", (q) => q.eq("graceSku", patch.graceSku))
        .first();
      if (!doc) {{ console.warn("NOT FOUND:", patch.graceSku); notFound++; continue; }}
      const upd: Record<string, number> = {{}};
      if (patch.webPrice1pc  != null) upd.webPrice1pc  = patch.webPrice1pc;
      if (patch.webPrice10pc != null) upd.webPrice10pc = patch.webPrice10pc;
      if (patch.webPrice12pc != null) upd.webPrice12pc = patch.webPrice12pc;
      await ctx.db.patch(doc._id, upd);
      updated++;
    }}
    return `✅ Patched ${{updated}} products. ⚠️ ${{notFound}} SKUs not found.`;
  }},
}});
*/
"""
    path.write_text(content)
    print(f"\n  🔧 Patch file written → {path}")
    print(f"     Follow the instructions at the top of that file to apply it.")

# ── Step 5 — Main ─────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Audit Grace AI pricing vs live bestbottles.com")
    ap.add_argument("--url",      default=CONVEX_URL)
    ap.add_argument("--limit",    type=int, default=0, help="Max products (0=all)")
    ap.add_argument("--family",   help="Audit one family only, e.g. Elegant")
    ap.add_argument("--delay",    type=float, default=REQUEST_DELAY)
    ap.add_argument("--no-scrape", action="store_true", help="Skip web scraping (dry-run)")
    args = ap.parse_args()

    Path("data").mkdir(exist_ok=True)

    print("=" * 70)
    print("  CONVEX ↔ LIVE SITE PRICE AUDIT — Best Bottles (3-tier)")
    print(f"  Started:  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Convex:   {args.url}")
    print(f"  Compares: webPrice1pc  |  webPrice10pc  |  webPrice12pc")
    print("=" * 70)

    products = load_products(args.url)
    if args.family:
        products = [p for p in products if (p.get("family") or "").lower() == args.family.lower()]
        print(f"  Filtered to '{args.family}': {len(products)} products")
    if args.limit:
        products = products[:args.limit]
        print(f"  Capped to {args.limit} products.")

    with_url = [p for p in products if p.get("productUrl") or p.get("product_url")]
    no_url   = [p for p in products if not (p.get("productUrl") or p.get("product_url"))]

    print(f"\n  Total products:        {len(products)}")
    print(f"  Have URL (will check): {len(with_url)}")
    print(f"  No URL (skip):         {len(no_url)}")
    if not args.no_scrape:
        est = len(with_url) * args.delay / 60
        print(f"  Est. time:             ~{est:.0f} min ({args.delay}s/req)")
    print("=" * 70 + "\n")

    results: list[dict] = []
    stats = {
        "total": len(products), "checked": 0, "matches": 0,
        "mismatch_1pc": 0, "mismatch_10pc": 0, "mismatch_12pc": 0, "mismatch_both": 0,
        "no_url": len(no_url), "no_price_found": 0, "errors": 0,
    }

    # Add no-URL placeholders
    for p in no_url:
        results.append({
            "graceSku": p.get("graceSku") or "?", "family": p.get("family") or "?",
            "itemName": (p.get("itemName") or "")[:90], "url": "", "status": "NO_URL",
            "stored_1pc": p.get("webPrice1pc"), "stored_10pc": p.get("webPrice10pc"),
            "stored_12pc": p.get("webPrice12pc"),
        })

    for idx, product in enumerate(with_url):
        sku = product.get("graceSku") or "???"
        pct = (idx + 1) / len(with_url) * 100
        sys.stdout.write(f"\r  [{idx+1:4d}/{len(with_url)}] {pct:5.1f}%  {sku[:42]:42s}")
        sys.stdout.flush()

        if args.no_scrape:
            result = {
                "graceSku": sku, "family": product.get("family") or "?",
                "itemName": (product.get("itemName") or "")[:90],
                "url": product.get("productUrl") or "", "status": "SKIPPED",
                "stored_1pc": product.get("webPrice1pc"),
                "stored_10pc": product.get("webPrice10pc"),
                "stored_12pc": product.get("webPrice12pc"),
            }
        else:
            result = audit_product(product)
            time.sleep(args.delay)

        s = result.get("status", "")
        stats["checked"] += 1
        if   s == "MATCH":           stats["matches"] += 1
        elif s == "MISMATCH_BOTH":   stats["mismatch_both"] += 1; stats["mismatch_1pc"] += 1; stats["mismatch_12pc"] += 1
        elif s == "MISMATCH_1PC":    stats["mismatch_1pc"] += 1
        elif s == "MISMATCH_12PC":   stats["mismatch_12pc"] += 1
        elif s == "MISMATCH_10PC":   stats["mismatch_10pc"] += 1
        elif s == "NO_PRICE_FOUND":  stats["no_price_found"] += 1
        elif s.startswith("ERROR"):  stats["errors"] += 1
        results.append(result)

    # ── Report ────────────────────────────────────────────────────────────────
    print(f"\n\n{'=' * 70}")
    print("  AUDIT COMPLETE")
    print(f"  ✅  Price matches:      {stats['matches']}")
    print(f"  ⚠️   1pc mismatches:    {stats['mismatch_1pc']}")
    print(f"  ⚠️   10pc mismatches:   {stats['mismatch_10pc']}")
    print(f"  ⚠️   12pc mismatches:   {stats['mismatch_12pc']}")
    print(f"  🔍  No price on page:   {stats['no_price_found']}")
    print(f"  ❌  Errors:             {stats['errors']}")
    print(f"  📭  No URL (skipped):   {stats['no_url']}")
    total_issues = stats["mismatch_1pc"] + stats["mismatch_10pc"] + stats["mismatch_12pc"]
    print(f"\n  ⚡  Total SKUs to fix:  {total_issues}")
    print(f"{'=' * 70}")

    mismatches = [r for r in results if "MISMATCH" in r.get("status", "")]
    mismatches.sort(key=lambda x: abs(x.get("diff_1pc") or 0), reverse=True)

    if mismatches:
        print(f"\n  TOP DISCREPANCIES (ordered by 1pc delta):")
        hdr = f"  {'SKU':40s} {'Fam':10s} {'Tier'} {'DB Price':>9} {'Live':>9} {'Diff':>7} {'Dir'}"
        print(hdr)
        print("  " + "-" * 80)
        for m in mismatches[:35]:
            for tier, stored_k, live_k, diff_k in [
                ("1pc",  "stored_1pc",  "live_1pc",  "diff_1pc"),
                ("10pc", "stored_10pc", "live_10pc", "diff_10pc"),
                ("12pc", "stored_12pc", "live_12pc", "diff_12pc"),
            ]:
                db   = m.get(stored_k)
                live = m.get(live_k)
                diff = m.get(diff_k) or 0
                if diff and diff > PRICE_TOLERANCE:
                    direction = "↑ OVER" if (db or 0) > (live or 0) else "↓ UNDER"
                    print(f"  {m['graceSku'][:40]:40s} {(m.get('family') or '?')[:10]:10s} "
                          f"{tier:4s} ${db or '?':>8}  ${live or '?':>8}  Δ{diff:>5.2f}  {direction}")

    # ── Save outputs ──────────────────────────────────────────────────────────
    with open(REPORT_JSON, "w") as f:
        json.dump({"audit_date": datetime.now().isoformat(), "stats": stats, "results": results}, f, indent=2)
    print(f"\n  💾 JSON → {REPORT_JSON}")

    csv_cols = [
        "status", "graceSku", "family", "itemName",
        "stored_1pc",  "live_1pc",  "diff_1pc",
        "stored_10pc", "live_10pc", "diff_10pc",
        "stored_12pc", "live_12pc", "diff_12pc",
        "live_stock", "url",
    ]
    with open(REPORT_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=csv_cols, extrasaction="ignore")
        w.writeheader()
        for priority in ["MISMATCH_BOTH", "MISMATCH_1PC", "MISMATCH_10PC", "MISMATCH_12PC",
                         "NO_PRICE_FOUND", "ERROR", "MATCH", "NO_URL", "SKIPPED"]:
            for r in results:
                if r.get("status", "") == priority or r.get("status", "").startswith(priority):
                    w.writerow(r)
    print(f"  📊 CSV  → {REPORT_CSV}")

    if mismatches and not args.no_scrape:
        write_patch_file(mismatches, PATCH_TS)

    print(f"\n  Done: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

if __name__ == "__main__":
    main()
