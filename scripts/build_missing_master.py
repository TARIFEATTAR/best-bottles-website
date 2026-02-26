import pandas as pd
import json
import math

def clean_value(val):
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, float):
        if math.isnan(val): return None
        if val.is_integer(): return int(val)
    return str(val).strip()

def main():
    # 1. Load existing JSON
    with open('data/grace_products_clean.json') as f:
        existing_data = json.load(f)
        
    existing_by_grace = {p.get('graceSku'): p for p in existing_data if p.get('graceSku')}
    existing_by_web = {p.get('websiteSku'): p for p in existing_data if p.get('websiteSku')}
    
    # 2. Iterate Excel
    file_path = 'docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx'
    df = pd.read_excel(file_path, sheet_name='Master Products')
    df = df.dropna(subset=['Grace SKU', 'Website SKU'], how='all')
    
    missing_products = []
    
    for idx, row in df.iterrows():
        g_sku = str(row.get('Grace SKU', '')).strip()
        w_sku = str(row.get('Website SKU', '')).strip()
        
        if g_sku in existing_by_grace or w_sku in existing_by_web:
            continue
            
        p = {
            "websiteSku": clean_value(row.get('Website SKU')),
            "graceSku": clean_value(row.get('Grace SKU')),
            "category": clean_value(row.get('Category')),
            "family": clean_value(row.get('Family')),
            "shape": clean_value(row.get('Shape')),
            "color": clean_value(row.get('Color')),
            "capacity": clean_value(row.get('Capacity')),
            "capacityMl": clean_value(row.get('Capacity (ml)')),
            "applicator": clean_value(row.get('Applicator')),
            "capColor": clean_value(row.get('Cap Color')),
            "trimColor": clean_value(row.get('Trim Color')),
            "capStyle": clean_value(row.get('Cap Style')),
            "neckThreadSize": clean_value(row.get('Neck Thread Size')),
            "heightWithCap": clean_value(row.get('Height with Cap')),
            "heightWithoutCap": clean_value(row.get('Height without Cap')),
            "diameter": clean_value(row.get('Diameter')),
            "bottleWeightG": clean_value(row.get('Bottle Weight (g)')),
            "qbPrice": clean_value(row.get('QB Price')),
            "webPrice1pc": clean_value(row.get('Web Price (1pc)')),
            "webPrice12pc": clean_value(row.get('Web Price (12pc)')),
            "stockStatus": clean_value(row.get('Stock Status')),
            "itemName": clean_value(row.get('Item Name')),
            "itemDescription": clean_value(row.get('Item Description')),
            "dataGrade": clean_value(row.get('Data Grade')),
            "usage": clean_value(row.get('Usage')),
            "productUrl": None,
            "verified": False
        }
        missing_products.append(p)
        
    print(f"Extracted {len(missing_products)} missing products.")
    
    with open('data/master_sheet_missing.json', 'w') as f:
        json.dump(missing_products, f, indent=2)
        
if __name__ == "__main__":
    main()
