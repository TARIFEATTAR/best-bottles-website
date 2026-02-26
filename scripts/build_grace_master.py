import json
import pandas as pd
import numpy as np

MASTER_XLSX = "docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx"
RAW_JSON = "data/bestbottles_raw_website_data.json"
OUTPUT_JSON = "data/grace_products_final.json"
OUTPUT_CSV = "data/grace_products_final.csv"

def main():
    print("Loading ONLY the Scraped JSON Data (The pure 2,285)...")
    try:
        with open(RAW_JSON, 'r') as f:
            scraped_list = json.load(f)
    except Exception as e:
        print(f"Could not load scraped JSON: {e}")
        return

    # Create a lookup dictionary by Website SKU from the Master Blueprint
    # (We are ONLY using the Blueprint to steal the Thread Size and Family, we are NOT adding the ghost products)
    print("Loading Excel Master Blueprint for reference tags ONLY...")
    df = pd.read_excel(MASTER_XLSX, sheet_name=0)
    df = df.replace({np.nan: None})
    
    blueprint_dict = {}
    for index, row in df.iterrows():
        web_sku = str(row.get('Website SKU', '')).strip().lower()
        if web_sku:
            blueprint_dict[web_sku] = row

    base_bottles = []
    components = []
    all_products = []

    print(f"Purifying {len(scraped_list)} live scraped products...")

    for item in scraped_list:
        web_sku = str(item.get('websiteSku', '')).strip().lower()
        
        # See if this live product has a match in the Blueprint to steal its structural DNA
        blueprint_row = blueprint_dict.get(web_sku, {})
        
        # If it's not in the blueprint, we still keep it, but we have to guess its category
        category = str(blueprint_row.get('Category', '')).strip()
        if not category or category == 'None':
            # Basic fallback heuristic just in case it's a brand new product not in the old Master Sheet
            if any(x in str(item.get('itemName')).lower() for x in ['cap', 'spray', 'pump', 'roller', 'plug', 'dropper']):
                category = 'Component'
            else:
                category = 'Glass Bottle'
                
        family = str(blueprint_row.get('Family', '')).strip()
        thread_size = str(item.get('neckThreadSize', '')) or str(blueprint_row.get('Neck Thread Size', '')).strip()
        grace_sku = str(blueprint_row.get('Grace SKU', '')).strip()

        # Safely parse numeric fields — Scraper is Priority 1, Master Sheet is fallback for bulk tiers
        try: price_1 = float(item.get('price1pc') or 0.0)
        except: price_1 = 0.0

        try: price_10 = float(item.get('price10pc') or 0.0)
        except: price_10 = 0.0
        if price_10 == 0.0:
            try: price_10 = float(blueprint_row.get('Web Price (10pc)') or 0.0)
            except: price_10 = 0.0

        try: price_12 = float(item.get('price12pc') or 0.0)
        except: price_12 = 0.0
        if price_12 == 0.0:
            try: price_12 = float(blueprint_row.get('Web Price (12pc)') or 0.0)
            except: price_12 = 0.0

        product = {
            'id': blueprint_row.get('Product ID') or f"NEW-{web_sku.upper()}",
            'grace_sku': grace_sku if grace_sku and grace_sku != 'None' else f"BB-{web_sku.upper()}",
            'website_sku': item.get('websiteSku'),
            'category': category,
            'family': family if family and family != 'None' else None,
            'capacity': item.get('capacity') or blueprint_row.get('Capacity'),
            'neck_thread_size': thread_size if thread_size and thread_size != 'None' else None,
            'item_name': item.get('itemName'),
            'item_description': item.get('itemDescription'),
            'image_url': item.get('imageUrl'),
            'price_1': price_1 if price_1 > 0 else None,
            'price_10': price_10 if price_10 > 0 else None,
            'price_12': price_12 if price_12 > 0 else None,
            'in_stock': True, # It's live on the site, so we assume it's in stock
            'product_url': item.get('productUrl')
        }
        
        all_products.append(product)
        
        if category == 'Component':
            components.append(product)
        else:
            base_bottles.append(product)

    print(f"Registered {len(base_bottles)} Base Bottles and {len(components)} Components.")

    print("Running Fitment Engine...")
    
    # Apply the Matrix rules ONLY to the 2,285 pure scraped items
    for bottle in base_bottles:
        bottle_components = []
        thread = str(bottle.get('neck_thread_size') or '')
        
        if thread == 'None' or not thread:
            bottle['compatible_components'] = []
            continue
            
        for comp in components:
            comp_thread = str(comp.get('neck_thread_size') or '')
            
            if thread != comp_thread:
                continue
                
            comp_applicator = str(comp.get('item_name') or '').lower()
            fits = False
            
            # --- V1 Matrix Logic (Thread Size + Basic Allowances) ---
            if thread == '17-415':
                fits = True
            elif thread == '15-415':
                if any(x in comp_applicator for x in ['cap', 'spray', 'closure']):
                    fits = True
            elif thread in ['13-415', '18-415', '8-425', '18-400', '20-400']:
                fits = True
            else:
                fits = True
                
            if fits:
                bottle_components.append({
                    'grace_sku': comp['grace_sku'],
                    'item_name': comp['item_name'],
                    'image_url': comp['image_url'],
                    'price_1': comp['price_1'],
                    'price_12': comp['price_12']
                })
                
        bottle['compatible_components'] = bottle_components

    # 4. Save Master JSON
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(all_products, f, indent=2)

    # 5. Save Review CSV (Drop nested arrays for flat CSV)
    csv_data = []
    for p in all_products:
        flat_p = p.copy()
        if 'compatible_components' in flat_p:
            flat_p['compatible_components_count'] = len(flat_p['compatible_components'])
            del flat_p['compatible_components']
        csv_data.append(flat_p)
        
    pd.DataFrame(csv_data).to_csv(OUTPUT_CSV, index=False)

    print(f"Success! Master Database assembled. Final records: {len(all_products)}")
    print(f"Saved JSON payload to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
