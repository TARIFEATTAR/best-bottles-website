#!/usr/bin/env python3
"""Create a safe patch plan from diff output."""

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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", type=Path, default=get_default_audit_dir())
    parser.add_argument("--diff", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    diff_path = args.diff or (args.audit_dir / "diff_scrape_vs_convex.json")
    output_path = args.output or (args.audit_dir / "reconcile_patch_plan.json")

    if not diff_path.exists():
        raise SystemExit(f"Diff file not found: {diff_path}")

    diff_payload = json.loads(diff_path.read_text(encoding="utf-8"))
    color_mismatches: list[dict[str, Any]] = diff_payload.get("colorMismatches", [])
    capacity_mismatches: list[dict[str, Any]] = diff_payload.get("capacityMismatches", [])

    auto_patches = []
    manual_review = []

    for mismatch in color_mismatches:
        confidence = (mismatch.get("confidence") or "none").lower()
        website_sku = mismatch.get("websiteSku")
        live_color = mismatch.get("liveColor")
        convex_color = mismatch.get("convexColor")

        proposal = {
            "websiteSku": website_sku,
            "set": {"color": live_color},
            "reason": (
                f"Color mismatch from live scrape; Convex={convex_color}, Live={live_color}"
            ),
        }
        if confidence == "high" and website_sku and live_color:
            auto_patches.append(proposal)
        else:
            manual_review.append(
                {
                    **proposal,
                    "status": "needs_manual_review",
                    "confidence": confidence,
                }
            )

    for mismatch in capacity_mismatches:
        manual_review.append(
            {
                "websiteSku": mismatch.get("websiteSku"),
                "set": {"capacityMl": mismatch.get("liveCapacityMl")},
                "reason": (
                    f"Capacity mismatch; Convex={mismatch.get('convexCapacityMl')} "
                    f"Live={mismatch.get('liveCapacityMl')}"
                ),
                "status": "manual_review_required",
                "confidence": "medium",
            }
        )

    plan = {
        "generatedAt": datetime.now().isoformat(),
        "sourceDiff": str(diff_path),
        "summary": {
            "autoPatchCount": len(auto_patches),
            "manualReviewCount": len(manual_review),
        },
        "autoPatches": auto_patches,
        "manualReview": manual_review,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    print(f"Saved patch plan: {output_path}")
    print(json.dumps(plan["summary"], indent=2))


if __name__ == "__main__":
    main()
