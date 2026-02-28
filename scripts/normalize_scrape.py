#!/usr/bin/env python3
"""Normalize live scrape output for deterministic diffs."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent

COLOR_PATTERNS = [
    ("Cobalt Blue", [r"\bcobalt blue\b", r"\bblue glass\b"]),
    ("Frosted", [r"\bfrosted glass\b", r"\bfrosted bottle\b", r"\bfrost\b"]),
    ("Clear", [r"\bclear glass\b", r"\bclear bottle\b"]),
    ("Amber", [r"\bamber glass\b", r"\bamber bottle\b"]),
    ("Black", [r"\bblack glass\b", r"\bblack bottle\b"]),
    ("White", [r"\bwhite glass\b", r"\bwhite bottle\b"]),
    ("Green", [r"\bgreen glass\b", r"\bgreen bottle\b"]),
]


def get_default_audit_dir() -> Path:
    day = datetime.now().strftime("%Y-%m-%d")
    return ROOT / "data" / "audits" / day


def parse_capacity_ml(*candidates: str | None) -> float | None:
    for candidate in candidates:
        if not candidate:
            continue
        match = re.search(r"(\d+(?:\.\d+)?)\s*ml\b", candidate, flags=re.I)
        if match:
            return float(match.group(1))
    return None


def detect_color(item_name: str | None, item_description: str | None) -> tuple[str | None, str | None, str]:
    text = " ".join([item_name or "", item_description or ""]).lower()
    for canonical, patterns in COLOR_PATTERNS:
        for pattern in patterns:
            if re.search(pattern, text):
                return canonical, pattern, "high"
    if text.strip():
        return None, None, "none"
    return None, None, "none"


def normalize_entry(entry: dict[str, Any]) -> dict[str, Any] | None:
    website_sku_raw = (entry.get("websiteSku") or "").strip()
    if not website_sku_raw:
        return None
    website_sku = website_sku_raw.upper()

    item_name = (entry.get("itemName") or "").strip() or None
    item_description = (entry.get("itemDescription") or "").strip() or None
    color, color_pattern, confidence = detect_color(item_name, item_description)
    capacity_ml = parse_capacity_ml(entry.get("capacity"), item_name, item_description)

    return {
        "websiteSku": website_sku,
        "productUrl": entry.get("productUrl"),
        "itemName": item_name,
        "itemDescription": item_description,
        "capacityRaw": entry.get("capacity"),
        "capacityMl": capacity_ml,
        "colorDetected": color,
        "colorEvidencePattern": color_pattern,
        "colorConfidence": confidence,
        "webPrice1pc": entry.get("webPrice1pc"),
        "webPrice10pc": entry.get("webPrice10pc"),
        "webPrice12pc": entry.get("webPrice12pc"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", type=Path, default=get_default_audit_dir())
    parser.add_argument("--input", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    in_path = args.input or (args.audit_dir / "live_scrape_raw.json")
    out_path = args.output or (args.audit_dir / "live_scrape_normalized.json")

    if not in_path.exists():
        raise SystemExit(f"Input file not found: {in_path}")

    payload = json.loads(in_path.read_text(encoding="utf-8"))
    products = payload.get("products", [])

    normalized = []
    skipped = 0
    for entry in products:
        row = normalize_entry(entry)
        if row:
            normalized.append(row)
        else:
            skipped += 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now().isoformat(),
                "count": len(normalized),
                "skipped": skipped,
                "products": normalized,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Saved normalized scrape: {out_path}")
    print(f"Normalized: {len(normalized)} | Skipped(no websiteSku): {skipped}")


if __name__ == "__main__":
    main()
