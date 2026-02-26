import json
import pandas as pd

def main():
    with open('data/master_sheet_missing_matched.json') as f:
        missing = json.load(f)

    with open('data/firecrawl_url_map.json') as f:
        url_map_raw = json.load(f)
        
    url_titles = {u.get('url'): u.get('title') or u.get('description', '') for u in url_map_raw.get('links', []) if isinstance(u, dict)}

    # Add URL titles for easier manual review
    for m in missing:
        u = m.get('productUrl')
        if u:
            m['Guessed URL Title'] = url_titles.get(u, '')
        else:
            m['Guessed URL Title'] = ''

    df = pd.DataFrame(missing)
    
    # Reorder columns slightly for review readability
    cols_front = ['graceSku', 'websiteSku', 'family', 'capacity', 'itemName', 'match_score', 'productUrl', 'Guessed URL Title']
    cols_remaining = sorted([c for c in df.columns if c not in cols_front])
    df = df[cols_front + cols_remaining]

    out_path = 'docs/MasterSheet_MissingProducts_Audit.xlsx'
    df.to_excel(out_path, index=False)
    print(f"✅ Generated {out_path} with {len(missing)} missing products.")

if __name__ == '__main__':
    main()
