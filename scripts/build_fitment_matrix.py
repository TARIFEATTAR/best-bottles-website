"""
build_fitment_matrix.py  —  v3.0  UNIVERSAL ARCHITECTURE

Builds the SKU-level component fitment matrix using:
  1. ODS fitment rules (which component TYPES fit each bottle family)
  2. grace_products_clean.json (actual component SKU catalog)

NEW 3-TIER HIERARCHY FOR ROLLERS:
  Base Bottle  ->  Applicator (Insert)  ->  Outer Cap (Lid)

This script maps each bottle to its compatible components.
Rollers are split into:
  - Plastic Roller (Insert)
  - Metal Roller (Insert)
  - Roll-On Cap (The Lids that fit over either insert)
"""

import json
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict

T = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0'
X = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'

# ── 1. Parse ODS fitment rules ────────────────────────────────────────────────
def get_cell_text(cell):
    texts = []
    for p in cell.findall(f'.//{{{X}}}p'):
        t = ''.join(p.itertext()).strip()
        if t:
            texts.append(t)
    repeat = cell.get(f'{{{T}}}number-columns-repeated')
    return (''.join(texts), int(repeat) if repeat else 1)

def parse_sheet(sheet):
    rows_out = []
    for row in sheet.findall(f'{{{T}}}table-row'):
        cells = []
        for cell in row.findall(f'{{{T}}}table-cell'):
            text, repeat = get_cell_text(cell)
            for _ in range(min(repeat, 20)):
                cells.append(text)
        while cells and not cells[-1]:
            cells.pop()
        if cells:
            rows_out.append(cells)
    return rows_out

with zipfile.ZipFile("docs/Bottles and Fitment options.ods", 'r') as z:
    with z.open('content.xml') as f:
        root = ET.parse(f).getroot()

sheets = root.findall(f'.//{{{T}}}table')

ODS_RULES = {}

for sheet in sheets:
    name = sheet.get(f'{{{T}}}name')
    rows = parse_sheet(sheet)
    if len(rows) < 2:
        continue

    header_row = rows[1]  
    
    COL_MAP = {}
    for i, h in enumerate(header_row):
        hl = h.lower().strip()
        if hl in ('reducers', 'reducer'):
            COL_MAP[i] = 'Reducer'
        elif hl in ('short caps with liner', 'short cap with liner', 'short caps with liners',
                    'caps with liners', 'short caps'):
            COL_MAP[i] = 'Short Cap'
        elif hl in ('tall caps with liner', 'tall cap with liner', 'tall caps with liners',
                    'tall caps'):
            COL_MAP[i] = 'Tall Cap'
        elif hl in ('roller plug plastic', 'roller plug metal'):
            # It maps to ALL 3 parts of the roller system
            COL_MAP[i] = 'Roller System'
        elif hl in ('roll on cap options', 'roll-on cap options', 'rollon cap options'):
            if i not in COL_MAP.values():
                COL_MAP[i] = 'Roller System'
        elif hl in ('spray top options', 'sprayers', 'sprayer'):
            COL_MAP[i] = 'Sprayer'
        elif hl in ('bulb sprayers - with and without tassels', 'bulb sprayer', 'bulb sprayers'):
            COL_MAP[i] = 'Antique Bulb Sprayer'
        elif hl in ('lotion pump options', 'lotion pumps', 'lotion pump'):
            COL_MAP[i] = 'Lotion Pump'
        elif hl in ('droppers', 'dropper'):
            COL_MAP[i] = 'Dropper'

    for row in rows[2:]:
        if not row or row == header_row:
            continue
        bottle_name = row[0].strip()
        bottle_code = row[1].strip() if len(row) > 1 else ''

        if not bottle_name or bottle_name.lower().startswith(('bottle', '18/415', '13/415',
                                                               '15/415', '17/415', 'boston',
                                                               'special')):
            continue

        compatible_types = set()
        for col_idx, comp_type in COL_MAP.items():
            if col_idx < len(row) and row[col_idx].strip().lower() == 'x':
                if comp_type == 'Roller System':
                    compatible_types.add('Plastic Roller')
                    compatible_types.add('Metal Roller')
                    compatible_types.add('Roll-On Cap')
                else:
                    compatible_types.add(comp_type)

        key = bottle_code if bottle_code else bottle_name
        ODS_RULES[key] = {
            'bottleName':      bottle_name,
            'bottleCode':      bottle_code,
            'sheetName':       name,
            'compatibleTypes': sorted(compatible_types),
        }

# ── 2. Load products ──────────────────────────────────────────────────────────
with open("data/grace_products_clean.json") as f:
    products = json.load(f)

# ── 3. Build component lookup ───────────────────────────────────────
# Explicitly EXCLUDE full bottle bundles that happen to have applicators attached
BOTTLE_CATS = {
    'Glass Bottle', 'Glass Jar', 'Packaging', 'Packaging Box',
    'Aluminum Bottle', 'Plastic Bottle', 'Accessory', 'Other'
}

components = [p for p in products
              if p.get('category') not in BOTTLE_CATS
              and p.get('neckThreadSize')]

VERIFIED_17415_ROLLONCAP_SKUS = {
    "CpRoll17-415BlkDot", "CpRoll17-415Cu", "CpRoll17-415MattGl", "CpRoll17-415MattSl",
    "CpRoll17-415PnkDot", "CpRoll17-415ShnBlk", "CpRoll17-415ShnGl", "CpRoll17-415ShnSl",
    "CpRoll17-415SlDot", "CpRoll17-415White", "CP17-415BlkPP", "CPRoll10mlGl", 
    "CPRoll9mlBlkw/dots", "CPRoll9mlPnkdots",
}

def classify_component(p):
    app   = p.get('applicator') or ''
    fam   = p.get('family') or ''
    cat   = p.get('category') or ''
    name  = (p.get('itemName') or '').lower()
    sku   = p.get('websiteSku', '')
    thread= (p.get('neckThreadSize') or '').strip()
    types = []

    # ── Roll-On Outer Caps (Lid) ──────────────
    is_rollon = (cat == 'Roll-On Cap' or (app == 'Roller Ball' and fam == 'Roll-On Cap'))
    if is_rollon:
        if thread == "17-415":
            if sku in VERIFIED_17415_ROLLONCAP_SKUS:
                types.append('Roll-On Cap')
        else:
            types.append('Roll-On Cap')

    # ── Roller Inserts ──────────────
    elif app == 'Plastic Roller' or (app == 'Roller Ball' and 'plastic' in name):
        types.append('Plastic Roller')
        
    elif app == 'Metal Roller' or (app == 'Roller Ball' and 'metal' in name):
        types.append('Metal Roller')

    # ── Short Cap ──────────────────────────────────────────────────────────
    elif (app == 'Cap/Closure' or
          cat == 'Cap/Closure' or
          (not app and fam in ('Cap', 'Cap/Closure') and cat in ('Component', 'Cap/Closure'))):
        types.append('Short Cap')

    # ── Reducer ────────────────────────────────────────────────────────────
    elif app == 'Reducer' or fam == 'Reducer':
        types.append('Reducer')

    # ── Sprayer ────────────────────────────────────────────────
    elif (app == 'Sprayer' and fam in ('Sprayer', 'Component')
          and cat not in ('Lotion Bottle',)):
        types.append('Sprayer')

    # ── Antique / Bulb Sprayer ─────────────────────────────────────────────
    elif ((not app and fam == 'Sprayer' and cat == 'Component') or
          (app == 'Sprayer' and cat == 'Cap/Closure' and 'tassel' in name)):
        types.append('Antique Bulb Sprayer')

    # ── Dropper ────────────────────────────────────────────────────────────
    elif app == 'Dropper' or fam == 'Dropper':
        types.append('Dropper')

    # ── Lotion Pump ───────────────────────────────────────────────────────
    elif (app in ('Lotion Pump', 'Pump') and cat == 'Component') or (not app and fam == 'Lotion Pump' and cat == 'Component'):
        types.append('Lotion Pump')

    return types

comp_by_type_thread = defaultdict(list)
for c in components:
    thread = (c.get('neckThreadSize') or '').strip()
    for mtype in classify_component(c):
        comp_by_type_thread[(mtype, thread)].append({
            'websiteSku':  c.get('websiteSku'),
            'graceSku':    c.get('graceSku'),
            'itemName':    c.get('itemName'),
            'webPrice1pc': c.get('webPrice1pc'),
            'capColor':    c.get('capColor'),
            'trimColor':   c.get('trimColor'),
            'stockStatus': c.get('stockStatus'),
            'ballMaterial':c.get('ballMaterial'),
        })

# ── 4. Thread-size default compatibility ─────────────────────────────────────
THREAD_COMPAT = {
    '13-415': ['Reducer', 'Short Cap', 'Plastic Roller', 'Metal Roller', 'Roll-On Cap', 'Sprayer'],
    '15-415': ['Short Cap', 'Sprayer'],
    '17-415': ['Plastic Roller', 'Metal Roller', 'Roll-On Cap', 'Sprayer', 'Lotion Pump'],
    '18-415': ['Reducer', 'Short Cap', 'Dropper', 'Sprayer', 'Antique Bulb Sprayer', 'Lotion Pump'],
    '18-400': ['Reducer', 'Short Cap', 'Dropper', 'Sprayer', 'Antique Bulb Sprayer', 'Lotion Pump'],
    '20-400': ['Short Cap', 'Plastic Roller', 'Metal Roller', 'Roll-On Cap', 'Dropper'],
}

BOTTLE_CODE_COMPAT = {
    code: rule['compatibleTypes']
    for code, rule in ODS_RULES.items()
    if rule['compatibleTypes'] and code.strip()
}
SORTED_CODES = sorted(BOTTLE_CODE_COMPAT.keys(), key=len, reverse=True)

def get_compat_types(websiteSku, thread):
    for code in SORTED_CODES:
        if websiteSku.startswith(code):
            return BOTTLE_CODE_COMPAT[code]
    return THREAD_COMPAT.get(thread)

# ── 5. Build matrix on each bottle ───────────────────────────────────────────
bottles = [p for p in products if p.get('category') == 'Glass Bottle']

for bottle in bottles:
    thread = (bottle.get('neckThreadSize') or '').strip()
    sku    = bottle.get('websiteSku', '')

    if not thread:
        bottle['fitmentStatus'] = 'missing_thread'
        continue

    compat_types = get_compat_types(sku, thread)
    if not compat_types:
        bottle['fitmentStatus'] = 'unknown_thread'
        continue

    comp_map = {}
    for ctype in compat_types:
        matching = comp_by_type_thread.get((ctype, thread), [])
        if matching:
            comp_map[ctype] = matching

    bottle['components'] = comp_map if comp_map else None
    if comp_map:
        has_gaps = len(comp_map) < len(compat_types)
        bottle['fitmentStatus'] = 'mapped_partial' if has_gaps else 'mapped'
        if has_gaps:
            bottle['catalogGaps'] = [t for t in compat_types if t not in comp_map]
    else:
        bottle['fitmentStatus'] = 'mapped_no_components'

# ── 6. Save ───────────────────────────────────────────────────────────────────
with open("data/grace_products_clean.json", "w") as f:
    json.dump(products, f, indent=2)

print("✅ Fitment Matrix v3.0 built with new 3-tier Universal Architecture.")

sample = next((b for b in bottles if b.get('websiteSku') == 'GBCylAmb9MtlRollBlkDot'), None)
if sample:
    print(f"\n────────────────────────────────────────────────────────────")
    print(f"SAMPLE OUTPUT — {sample.get('itemName')}")
    print(f"────────────────────────────────────────────────────────────")
    for ctype, skus in (sample.get('components') or {}).items():
        print(f"  ✅ {ctype:<15}: {len(skus)} variants available")
    for gap in (sample.get('catalogGaps') or []):
        print(f"  ❌ {gap:<15}: CATALOG GAP")
