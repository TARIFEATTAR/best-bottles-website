#!/usr/bin/env python3
"""Diff normalized live scrape data against Convex snapshot."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent


def get_default_audit_dir() -> Path:
    day = datetime.now().strftime("%Y-%m-%d")
    return ROOT / "data" / "audits" / day


def upper_sku(value: Any) -> str:
    return str(value or "").strip().upper()


def float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_markdown_report(diff: dict[str, Any], out_path: Path) -> None:
    summary = diff["summary"]
    lines = [
        "# Catalog Audit Diff Report",
        "",
        f"- Generated: {diff['generatedAt']}",
        f"- Live normalized products: {summary['liveCount']}",
        f"- Convex snapshot products: {summary['convexCount']}",
        f"- Missing in Convex: {summary['missingInConvex']}",
        f"- Missing on Live: {summary['missingOnLive']}",
        f"- Color mismatches: {summary['colorMismatches']}",
        f"- Capacity mismatches: {summary['capacityMismatches']}",
        "",
        "## Top Color Mismatches",
        "",
    ]
    top = diff["colorMismatches"][:20]
    if not top:
        lines.append("- None")
    else:
        for row in top:
            lines.append(
                f"- `{row['websiteSku']}`: Convex=`{row['convexColor']}` vs Live=`{row['liveColor']}` "
                f"(confidence: {row['confidence']})"
            )
    out_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", type=Path, default=get_default_audit_dir())
    parser.add_argument("--live", type=Path, default=None)
    parser.add_argument("--convex", type=Path, default=None)
    args = parser.parse_args()

    live_path = args.live or (args.audit_dir / "live_scrape_normalized.json")
    convex_path = args.convex or (args.audit_dir / "convex_snapshot.json")

    if not live_path.exists():
        raise SystemExit(f"Live normalized input not found: {live_path}")
    if not convex_path.exists():
        raise SystemExit(
            f"Convex snapshot not found: {convex_path}\n"
            "Run: node scripts/export_convex_snapshot.mjs"
        )

    live_payload = json.loads(live_path.read_text(encoding="utf-8"))
    convex_payload = json.loads(convex_path.read_text(encoding="utf-8"))

    live_products = live_payload.get("products", [])
    convex_products = convex_payload.get("products", [])

    live_by_sku = {upper_sku(row.get("websiteSku")): row for row in live_products if row.get("websiteSku")}
    convex_by_sku = {
        upper_sku(row.get("websiteSku")): row for row in convex_products if row.get("websiteSku")
    }

    missing_in_convex = []
    missing_on_live = []
    color_mismatches = []
    capacity_mismatches = []

    for sku, live in live_by_sku.items():
        convex = convex_by_sku.get(sku)
        if not convex:
            missing_in_convex.append({"websiteSku": sku, "productUrl": live.get("productUrl")})
            continue

        live_color = live.get("colorDetected")
        convex_color = convex.get("color")
        if live_color and convex_color and str(live_color).lower() != str(convex_color).lower():
            color_mismatches.append(
                {
                    "websiteSku": sku,
                    "productUrl": live.get("productUrl") or convex.get("productUrl"),
                    "convexColor": convex_color,
                    "liveColor": live_color,
                    "confidence": live.get("colorConfidence") or "none",
                    "itemName": live.get("itemName") or convex.get("itemName"),
                }
            )

        live_capacity = float_or_none(live.get("capacityMl"))
        convex_capacity = float_or_none(convex.get("capacityMl"))
        if live_capacity is not None and convex_capacity is not None and live_capacity != convex_capacity:
            capacity_mismatches.append(
                {
                    "websiteSku": sku,
                    "convexCapacityMl": convex_capacity,
                    "liveCapacityMl": live_capacity,
                    "itemName": live.get("itemName") or convex.get("itemName"),
                }
            )

    for sku, convex in convex_by_sku.items():
        if sku not in live_by_sku:
            missing_on_live.append({"websiteSku": sku, "productUrl": convex.get("productUrl")})

    diff = {
        "generatedAt": datetime.now().isoformat(),
        "summary": {
            "liveCount": len(live_by_sku),
            "convexCount": len(convex_by_sku),
            "missingInConvex": len(missing_in_convex),
            "missingOnLive": len(missing_on_live),
            "colorMismatches": len(color_mismatches),
            "capacityMismatches": len(capacity_mismatches),
        },
        "missingInConvex": missing_in_convex,
        "missingOnLive": missing_on_live,
        "colorMismatches": color_mismatches,
        "capacityMismatches": capacity_mismatches,
    }

    args.audit_dir.mkdir(parents=True, exist_ok=True)
    diff_path = args.audit_dir / "diff_scrape_vs_convex.json"
    md_path = args.audit_dir / "diff_scrape_vs_convex.md"
    diff_path.write_text(json.dumps(diff, indent=2), encoding="utf-8")
    build_markdown_report(diff, md_path)

    print(f"Saved diff JSON: {diff_path}")
    print(f"Saved diff Markdown: {md_path}")
    print(json.dumps(diff["summary"], indent=2))


if __name__ == "__main__":
    main()
