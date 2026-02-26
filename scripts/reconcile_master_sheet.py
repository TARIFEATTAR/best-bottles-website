import pandas as pd
import json

def main():
    # 1. Load existing database
    with open('data/grace_products_clean.json') as f:
        existing_data = json.load(f)
    
    # Create mapping of Grace SKU and Website SKU to their records (and URLs)
    existing_by_grace = {p.get('graceSku'): p for p in existing_data if p.get('graceSku')}
    existing_by_web = {p.get('websiteSku'): p for p in existing_data if p.get('websiteSku')}
    
    # 2. Load Master Sheet
    file_path = 'docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx'
    df = pd.read_excel(file_path, sheet_name='Master Products')
    
    # Drop rows with totally empty Grace SKUs and Website SKUs
    df = df.dropna(subset=['Grace SKU', 'Website SKU'], how='all')
    
    stats = {
        'total_master': len(df),
        'matched_perfect': 0,
        'matched_web_sku': 0,
        'matched_grace_sku_only': 0,
        'missing_from_db': 0,
        'missing_urls_for_matched': 0
    }
    
    missing_items = []
    
    for idx, row in df.iterrows():
        g_sku = str(row.get('Grace SKU', '')).strip()
        w_sku = str(row.get('Website SKU', '')).strip()
        
        match = None
        if g_sku in existing_by_grace:
            match = existing_by_grace[g_sku]
            stats['matched_grace_sku_only'] += 1
            if w_sku and w_sku == match.get('websiteSku'):
                stats['matched_perfect'] += 1
                stats['matched_grace_sku_only'] -= 1
        elif w_sku in existing_by_web:
            match = existing_by_web[w_sku]
            stats['matched_web_sku'] += 1
            
        if not match:
            stats['missing_from_db'] += 1
            missing_items.append({
                'Grace SKU': g_sku,
                'Website SKU': w_sku,
                'Item Name': str(row.get('Item Name', '')),
                'Family': str(row.get('Family', ''))
            })
        else:
            if not match.get('productUrl'):
                stats['missing_urls_for_matched'] += 1
                
    print("=== RECONCILIATION RESULTS ===")
    for k, v in stats.items():
        print(f"{k}: {v}")
        
    print(f"\nExample missing items ({len(missing_items)} total):")
    for m in missing_items[:15]:
        print(f"  {m['Grace SKU']:30s} | {m['Website SKU']:25s} | {m['Family']:15s} | {m['Item Name'][:40]}")

if __name__ == "__main__":
    main()
