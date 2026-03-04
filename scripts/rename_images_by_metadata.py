#!/usr/bin/env python3
"""
rename_images_by_metadata.py
────────────────────────────
Renames product images from SKU-based filenames (e.g. GBDiva100AnSpTslBlk.jpg)
to human-readable slugs (e.g. diva-100ml-black-antique-bulb-sprayer-tassel.jpg).

Usage:
    # Dry run (see what WOULD happen, no files moved):
    python3 scripts/rename_images_by_metadata.py --images-dir /path/to/images --dry-run

    # Rename only Diva family:
    python3 scripts/rename_images_by_metadata.py --images-dir /path/to/images --family Diva --dry-run

    # Execute renames for all families:
    python3 scripts/rename_images_by_metadata.py --images-dir /path/to/images

    # Execute, and also write a rename manifest (for reference/rollback):
    python3 scripts/rename_images_by_metadata.py --images-dir /path/to/images --manifest data/rename_manifest.json

The script reads from data/grace_products_final.csv and extracts:
  - family     (e.g. "Diva")
  - capacity   (e.g. "100 ml (3.38 oz)")
  - color      (parsed from item_name, e.g. "Black")
  - applicator (parsed from item_name, e.g. "Antique Bulb Sprayer")

Output slug format:
  {family}-{capacityMl}ml-{color}-{applicator}.{ext}
  → diva-100ml-black-antique-bulb-sprayer-tassel.jpg

If two SKUs would map to the same slug, a counter suffix is appended:
  → diva-100ml-black-antique-bulb-sprayer-tassel--2.jpg
"""

import argparse
import csv
import json
import os
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

# ─── CONFIG ───────────────────────────────────────────────────────────────────

CSV_PATH = Path(__file__).parent.parent / "data" / "grace_products_final.csv"

# Colors to detect from item_name (ordered longest-first so "Matte Silver" beats "Silver")
KNOWN_COLORS = [
    "Matte Silver", "Matte Gold", "Matte Black",
    "Antique Gold", "Antique Silver", "Antique Black",
    "Ivory", "Lavender", "Champagne", "Rose Gold",
    "Black", "Gold", "Silver", "White", "Clear",
    "Pink", "Red", "Blue", "Green", "Purple", "Brown",
]

# Applicator keywords to detect from item_name
KNOWN_APPLICATORS = [
    ("antique bulb sprayer with tassel", "antique-bulb-sprayer-tassel"),
    ("antique bulb sprayer", "antique-bulb-sprayer"),
    ("fine mist sprayer", "fine-mist-sprayer"),
    ("perfume spray pump", "perfume-spray-pump"),
    ("metal roller", "metal-roller"),
    ("plastic roller", "plastic-roller"),
    ("lotion pump", "lotion-pump"),
    ("glass stopper", "glass-stopper"),
    ("glass rod", "glass-rod"),
    ("dropper", "dropper"),
    ("reducer", "reducer"),
    ("atomizer", "atomizer"),
    # generic fallbacks
    ("roller", "roller"),
    ("sprayer", "sprayer"),
    ("pump", "pump"),
    ("stopper", "stopper"),
]

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    """Convert a free-form string to a lowercase URL slug."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\-]+", "-", text)
    text = re.sub(r"-{2,}", "-", text)
    return text.strip("-")


def parse_capacity_ml(raw: str) -> str:
    """Extract the ml number from strings like '100 ml (3.38 oz)' → '100ml'."""
    m = re.match(r"(\d+(?:\.\d+)?)\s*ml", raw, re.IGNORECASE)
    if m:
        # Format as integer if whole number
        val = float(m.group(1))
        return f"{int(val)}ml" if val == int(val) else f"{val}ml"
    return slugify(raw)


def detect_color(item_name: str) -> str:
    """Find the first matching known color in a product's item_name."""
    lower = item_name.lower()
    for color in KNOWN_COLORS:
        if color.lower() in lower:
            return slugify(color)
    return "unknown-color"


def detect_applicator(item_name: str) -> str:
    """Find the best matching applicator keyword in item_name."""
    lower = item_name.lower()
    for keyword, slug in KNOWN_APPLICATORS:
        if keyword in lower:
            return slug
    return ""


def build_slug(row: dict) -> str:
    """
    Build a human-readable slug from CSV row data.
    Format: {family}-{capacityMl}-{color}[-{applicator}]
    """
    family = slugify(row["family"])
    capacity = parse_capacity_ml(row["capacity"])
    color = detect_color(row["item_name"])
    applicator = detect_applicator(row["item_name"])

    parts = [family, capacity, color]
    if applicator:
        parts.append(applicator)

    return "-".join(parts)


def load_sku_map(family_filter: str | None = None) -> dict[str, str]:
    """
    Read CSV and return {website_sku: human_slug} mapping.
    If family_filter is set, only include that family.
    """
    if not CSV_PATH.exists():
        print(f"❌  CSV not found: {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    sku_to_slug: dict[str, str] = {}
    slug_counts: Counter = Counter()

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            family = row.get("family", "").strip()
            if family_filter and family.lower() != family_filter.lower():
                continue
            if not row.get("website_sku") or not row.get("family") or not row.get("capacity"):
                continue

            sku = row["website_sku"].strip()
            base_slug = build_slug(row)
            slug_counts[base_slug] += 1
            sku_to_slug[sku] = base_slug  # dedup handled in next pass

    # Second pass: add counter suffix to any duplicate slugs
    slug_seen: Counter = Counter()
    deduped: dict[str, str] = {}
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            family = row.get("family", "").strip()
            if family_filter and family.lower() != family_filter.lower():
                continue
            sku = row.get("website_sku", "").strip()
            if not sku:
                continue
            base_slug = sku_to_slug.get(sku)
            if not base_slug:
                continue
            if slug_counts[base_slug] > 1:
                slug_seen[base_slug] += 1
                deduped[sku] = f"{base_slug}--{slug_seen[base_slug]}"
            else:
                deduped[sku] = base_slug

    return deduped


def find_image_extensions(images_dir: Path) -> dict[str, str]:
    """
    Scan images_dir and return {stem_lowercase: full_path} mapping.
    Handles .jpg, .jpeg, .png, .gif, .webp (case-insensitive).
    """
    VALID_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    stem_map = {}
    for p in images_dir.iterdir():
        if p.suffix.lower() in VALID_EXTS:
            stem_map[p.stem.lower()] = p
    return stem_map


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Rename product images from SKU names to human-readable slugs.")
    parser.add_argument("--images-dir", required=True, help="Directory containing the product images to rename")
    parser.add_argument("--family", default=None, help="Only rename images for this product family (e.g. 'Diva')")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without renaming anything")
    parser.add_argument("--manifest", default=None, help="Path to write a JSON rename manifest (for rollback)")
    parser.add_argument("--copy", action="store_true", help="Copy files instead of renaming (keeps originals)")
    args = parser.parse_args()

    images_dir = Path(args.images_dir).resolve()
    if not images_dir.is_dir():
        print(f"❌  Images directory not found: {images_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"📂  Images dir : {images_dir}")
    print(f"📊  CSV source : {CSV_PATH}")
    print(f"🏷️   Family     : {args.family or 'ALL'}")
    print(f"🔍  Mode       : {'DRY RUN' if args.dry_run else ('COPY' if args.copy else 'RENAME')}")
    print()

    # Build mappings
    sku_to_slug = load_sku_map(args.family)
    print(f"📋  SKUs in mapping : {len(sku_to_slug)}")

    image_stems = find_image_extensions(images_dir)
    print(f"🖼️   Images found    : {len(image_stems)}")
    print()

    matched = 0
    skipped = 0
    collision = 0
    manifest = []

    for sku, new_slug in sorted(sku_to_slug.items()):
        src_path = image_stems.get(sku.lower())
        if src_path is None:
            # Also try without case
            src_path = image_stems.get(sku)
        if src_path is None:
            skipped += 1
            continue

        ext = src_path.suffix.lower()
        # Always output as .jpg if original was .gif (gifs are often just static)
        out_ext = ".jpg" if ext == ".gif" else ext
        dst_name = f"{new_slug}{out_ext}"
        dst_path = images_dir / dst_name

        if dst_path.exists() and dst_path != src_path:
            print(f"⚠️   COLLISION  {src_path.name} → {dst_name} (already exists, skipping)")
            collision += 1
            continue

        action = "COPY" if args.copy else "RENAME"
        print(f"{'🔵 [DRY RUN] ' if args.dry_run else '✅ '}{action}  {src_path.name}  →  {dst_name}")
        matched += 1

        manifest.append({
            "sku": sku,
            "slug": new_slug,
            "original": str(src_path),
            "renamed": str(dst_path),
        })

        if not args.dry_run:
            if args.copy:
                shutil.copy2(src_path, dst_path)
            else:
                src_path.rename(dst_path)

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print("─" * 60)
    print(f"✅  Processed  : {matched}")
    print(f"⏭️   No image   : {skipped} (SKU in CSV but no matching file found)")
    print(f"⚠️   Collisions : {collision}")
    print(f"📊  Total SKUs : {len(sku_to_slug)}")

    if args.dry_run:
        print()
        print("ℹ️   This was a DRY RUN — no files were changed.")
        print("    Remove --dry-run to execute.")

    # ── Manifest ──────────────────────────────────────────────────────────────
    if args.manifest and manifest:
        manifest_path = Path(args.manifest)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, "w") as mf:
            json.dump(manifest, mf, indent=2)
        print(f"\n📄  Manifest written → {manifest_path}")
        print("    Use this file to roll back renames if needed.")


if __name__ == "__main__":
    main()
