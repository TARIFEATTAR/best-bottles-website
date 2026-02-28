#!/usr/bin/env python3
"""Scrape live bestbottles product pages into a dated audit folder."""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
SITEMAP_URL = "https://www.bestbottles.com/sitemap.xml"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

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
STOP_PATTERN = "|".join(re.escape(label) for label in SPEC_LABELS)
LABEL_TO_FIELD = {
    "Item Type": "itemType",
    "Item Name": "itemName",
    "Item Description": "itemDescription",
    "Item Capacity": "capacity",
    "Item Height with Cap": "heightWithCap",
    "Item Height without Cap": "heightWithoutCap",
    "Item Diameter": "diameter",
    "Item Width": "width",
    "Item Depth": "depth",
    "Neck Thread Size": "neckThreadSize",
    "Closure Type": "closureType",
}


def fetch_text(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_sitemap_urls(xml_text: str) -> list[str]:
    root = ET.fromstring(xml_text)
    urls: list[str] = []
    for child in root:
        for sub in child:
            if "loc" in sub.tag and sub.text and "/product/" in sub.text:
                urls.append(sub.text.strip())
    return urls


def strip_html_to_text(html: str) -> str:
    no_script = re.sub(r"<script.*?</script>", " ", html, flags=re.I | re.S)
    no_style = re.sub(r"<style.*?</style>", " ", no_script, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", no_style)
    return re.sub(r"\s+", " ", text).strip()


def extract_specs(page_text: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for label in SPEC_LABELS:
        pattern = (
            rf"{re.escape(label)}:\s*(.+?)(?=(?:{STOP_PATTERN})\:|1\s*pcs?\s*[-–]|\Z)"
        )
        match = re.search(pattern, page_text, flags=re.I | re.S)
        if not match:
            continue
        value = re.sub(r"\s+", " ", match.group(1)).strip()
        value = re.sub(r"\s*Purchase:.*$", "", value, flags=re.I).strip()
        value = re.sub(r"\s*Nemat International.*$", "", value, flags=re.I).strip()
        field = LABEL_TO_FIELD[label]
        if value:
            data[field] = value
    return data


def extract_prices(page_text: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    one_pc = re.search(r"1\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*/\s*pc", page_text, re.I)
    ten_pc = re.search(r"10\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*/\s*pc", page_text, re.I)
    twelve_pc = re.search(r"12\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*/\s*pc", page_text, re.I)
    if one_pc:
        out["webPrice1pc"] = float(one_pc.group(1))
    if ten_pc:
        out["webPrice10pc"] = float(ten_pc.group(1))
    if twelve_pc:
        out["webPrice12pc"] = float(twelve_pc.group(1))
    return out


def extract_website_sku(html: str, page_text: str, url: str) -> str | None:
    # Most reliable source on these pages is still "Item Name: SKU"
    sku_match = re.search(r"Item Name:\s*([A-Za-z0-9._-]+)", page_text, re.I)
    if sku_match:
        return sku_match.group(1).strip()

    image_match = re.search(
        r"""src=["'][^"']*(?:enlarged_pics|store/capped)/([^"'/]+\.(?:jpg|jpeg|png|webp))["']""",
        html,
        re.I,
    )
    if image_match:
        return image_match.group(1).rsplit(".", 1)[0].strip()

    url_tail = url.rstrip("/").split("/")[-1]
    if url_tail:
        return re.sub(r"[^A-Za-z0-9._-]", "", url_tail) or None
    return None


def get_default_audit_dir() -> Path:
    day = datetime.now().strftime("%Y-%m-%d")
    return ROOT / "data" / "audits" / day


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=get_default_audit_dir())
    parser.add_argument("--limit", type=int, default=0, help="Optional URL limit")
    parser.add_argument("--delay", type=float, default=0.8, help="Delay between requests")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = args.output_dir / "live_scrape_raw.json"

    print(f"Fetching sitemap: {SITEMAP_URL}")
    sitemap_xml = fetch_text(SITEMAP_URL)
    urls = parse_sitemap_urls(sitemap_xml)
    if args.limit > 0:
        urls = urls[: args.limit]
    print(f"Will scrape {len(urls)} product URLs")

    scraped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for idx, url in enumerate(urls, start=1):
        try:
            html = fetch_text(url, timeout=18)
            text = strip_html_to_text(html)
            entry: dict[str, Any] = {"productUrl": url}
            entry.update(extract_specs(text))
            entry.update(extract_prices(text))
            sku = extract_website_sku(html, text, url)
            if sku:
                entry["websiteSku"] = sku
            scraped.append(entry)
        except Exception as exc:  # noqa: BLE001
            errors.append({"productUrl": url, "error": str(exc)})
        if idx % 50 == 0 or idx == len(urls):
            print(f"[{idx}/{len(urls)}] scraped={len(scraped)} errors={len(errors)}")
        time.sleep(args.delay)

    payload = {
        "generatedAt": datetime.now().isoformat(),
        "source": "bestbottles.com sitemap + product pages",
        "count": len(scraped),
        "errorCount": len(errors),
        "products": scraped,
        "errors": errors,
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Saved scrape output: {output_path}")


if __name__ == "__main__":
    main()
