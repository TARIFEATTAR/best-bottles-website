#!/usr/bin/env python
"""
Extract Master Products sheet from BestBottles_Master_v8.3 xlsx → JSON.

Output: data/master_v8.3_products.json

Rules:
  - Only fields relevant to the Grace enrichment migration.
  - Strings trimmed; 'nan'/'none'/'' normalized to None.
  - Numbers coerced from strings where possible.
  - Units stripped: "1 ±0.1 mm" → "1 mm", but we keep the raw display string.
"""
import json
import sys
import pandas as pd
from pathlib import Path

SRC = Path("/Users/jordanrichter/Downloads/BestBottles_Master_v8.3_Verification (1).xlsx")
DST = Path("data/master_v8.3_products.json")

def clean_str(v):
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = str(v).strip()
    if s == '' or s.lower() in ('none', 'nan', 'null'):
        return None
    return s

def clean_num(v):
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(',', '')
    if s == '' or s.lower() in ('none', 'nan', 'null'):
        return None
    # Extract leading number (handles "1 ±0.1 mm" → 1.0)
    import re
    m = re.search(r'-?\d+\.?\d*', s)
    if m:
        try:
            return float(m.group())
        except ValueError:
            return None
    return None

def main():
    if not SRC.exists():
        print(f"ERROR: master sheet not found at {SRC}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_excel(SRC, sheet_name='Master Products', engine='openpyxl')
    print(f"Loaded {len(df)} rows × {len(df.columns)} cols from {SRC.name}", file=sys.stderr)

    records = []
    for _, row in df.iterrows():
        grace_sku = clean_str(row.get('Grace SKU'))
        website_sku = clean_str(row.get('Website SKU'))
        if not grace_sku and not website_sku:
            continue  # Skip rows with no usable identifier

        records.append({
            "graceSku": grace_sku,
            "websiteSku": website_sku,
            # Enrichment fields
            "capStyle": clean_str(row.get('Cap Style')),
            "capColor": clean_str(row.get('Cap Color')),
            "caseQuantity": clean_num(row.get('Case Quantity')),
            "bottleWeightG": clean_num(row.get('Bottle Weight (g)')),
            "caseWeightG": clean_num(row.get('Case Weight (g)')),           # NEW
            "heightWithCap": clean_str(row.get('Height with Cap')),
            "heightWithoutCap": clean_str(row.get('Height without Cap')),
            "diameter": clean_str(row.get('Diameter')),
            "useCaseDescription": clean_str(row.get('Use Case Description')), # NEW
            "dataGrade": clean_str(row.get('Data Grade')),
            "bottleCollection": clean_str(row.get('Bottle Collection')),
            # Context fields (not patched, but useful for driver-side matching)
            "category": clean_str(row.get('Category')),
            "family": clean_str(row.get('Family')),
        })

    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(json.dumps(records, indent=2))
    print(f"Wrote {len(records)} records to {DST}", file=sys.stderr)

    # Quick fill-rate audit
    print("\nFill rates in extracted records:", file=sys.stderr)
    for key in ['graceSku', 'websiteSku', 'capStyle', 'capColor', 'caseQuantity',
                'bottleWeightG', 'caseWeightG', 'useCaseDescription', 'dataGrade']:
        filled = sum(1 for r in records if r.get(key) is not None)
        pct = 100 * filled / len(records) if records else 0
        print(f"  {key:<22} {filled}/{len(records)} ({pct:.1f}%)", file=sys.stderr)

if __name__ == "__main__":
    main()
