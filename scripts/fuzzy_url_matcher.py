import json
import re
from difflib import SequenceMatcher

def clean_url(url):
    return url.split('?')[0].split('#')[0].lower()

def get_url_words(url):
    slug = url.split('/')[-1]
    return set(re.findall(r'[a-z0-9]+', slug))

def calculate_score(product, url_words, url_string):
    score = 0
    
    # Family match
    family = (product.get('family') or '').lower()
    if family == 'boston round': family = 'boston-round'
    if family and family in url_string:
        score += 10
        
    capacity = (product.get('capacity') or '').lower()
    # e.g., "5 ml" -> ["5", "ml"]
    cap_match = re.search(r'(\d+)\s*(ml|oz)', capacity)
    if cap_match:
        if cap_match.group(1) in url_words:
            score += 15
            
    color = (product.get('color') or '').lower()
    if color and color in url_string:
        score += 8
        
    # Cap color/applicator words
    applicator = (product.get('applicator') or '').lower()
    cap_color = (product.get('capColor') or '').lower()
    
    for word in re.findall(r'[a-z0-9]+', applicator + " " + cap_color):
        if word in url_words:
            score += 5
            
    return score

def main():
    print("Loading missing URLs...")
    with open('data/master_sheet_missing.json') as f:
        missing = json.load(f)
        
    print("Loading firecrawl map...")
    with open('data/firecrawl_url_map.json') as f:
        url_map_raw = json.load(f)
        
    all_urls = [clean_url(u.get('url')) for u in url_map_raw.get('links', []) if 'product/' in u.get('url', '')]
    all_urls = list(set(all_urls))
    
    print(f"Loaded {len(all_urls)} unique product URLs.")
    
    url_data = []
    for u in all_urls:
        url_data.append({
            'url': u,
            'words': get_url_words(u),
            'string': u.split('/')[-1]
        })
        
    matched = 0
    
    for p in missing:
        best_score = 0
        best_url = None
        
        # Heuristics based matching
        for u in url_data:
            score = calculate_score(p, u['words'], u['string'])
            if score > best_score:
                best_score = score
                best_url = u['url']
                
        if best_score >= 30: # reasonable threshold to pair a capacity, family, and color/cap
            p['productUrl'] = best_url
            p['match_score'] = best_score
            matched += 1
        else:
            p['productUrl'] = None
            p['match_score'] = best_score
            
    print(f"Successfully matched URLs for {matched} out of {len(missing)} products!")
    
    with open('data/master_sheet_missing_matched.json', 'w') as f:
        json.dump(missing, f, indent=2)
        
    print("Saved to data/master_sheet_missing_matched.json")

    # Show some examples
    print("\n--- Match Examples ---")
    examples = [m for m in missing if m['productUrl']][:10]
    for e in examples:
        print(f"{e['graceSku']:20s} -> {e['productUrl']} (Score: {e['match_score']})")

if __name__ == "__main__":
    main()
