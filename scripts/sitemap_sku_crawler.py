import json
import asyncio
import aiohttp
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import re
import sys
import time

SITEMAP_URL = "https://www.bestbottles.com/sitemap.xml"
OUTPUT_MAP_FILE = "data/url_to_sku_map_sitemap.json"

async def extract_skus_from_html(html, url):
    soup = BeautifulSoup(html, 'html.parser')
    skus = set()
    
    # Method 1: <div class="col-md-12"><h1>SKU</h1></div>
    title_div = soup.find('div', class_='prdDetTitle')
    if title_div and title_div.h1:
        txt = title_div.h1.get_text(strip=True)
        if txt and "Wholesale" not in txt and "Glass" not in txt:
            skus.add(txt)
            
    # Method 2: <p><strong>Item Name:</strong> SKU</p>
    p_tags = soup.find_all('p')
    for p in p_tags:
        strong = p.find('strong')
        if strong and "Item Name:" in strong.get_text(strip=True):
            # Extract the text after "Item Name:"
            full_text = p.get_text(separator=" ", strip=True)
            match = re.search(r'Item Name:\s*(.*)', full_text)
            if match:
                sku_candidate = match.group(1).split()[0].strip() # Take the first word usually
                skus.add(sku_candidate)
                
    # Method 3: <div class="item active"><img src=".../GBCyl5SpryBluMatt.gif"
    img_tags = soup.find_all('img')
    for img in img_tags:
        src = img.get('src', '')
        if src.endswith('.gif') or src.endswith('.jpg') or src.endswith('.png'):
            filename = src.split('/')[-1]
            base_sku = filename.split('.')[0]
            if base_sku and len(base_sku) > 3 and not base_sku.islower():
                # Avoid generic filenames like banner.jpg
                skus.add(base_sku)
                
    return list(skus)[0] if skus else None

async def fetch_page(session, url, semaphore):
    async with semaphore:
        for attempt in range(3):
            try:
                async with session.get(url, timeout=15) as response:
                    if response.status == 200:
                        html = await response.text()
                        sku = await extract_skus_from_html(html, url)
                        return url, sku
                    return url, None
            except Exception:
                if attempt == 2:
                    return url, None
                await asyncio.sleep(2)

async def main():
    print("Fetching sitemap...")
    async with aiohttp.ClientSession(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}) as session:
        try:
            async with session.get(SITEMAP_URL, timeout=20) as r:
                content = await r.read()
            
            root = ET.fromstring(content)
            urls = []
            for child in root:
                for sub in child:
                    if 'loc' in sub.tag:
                        u = sub.text
                        if '/product/' in u:
                            urls.append(u)
            
            print(f"Extracted {len(urls)} product URLs from sitemap.")
            
        except Exception as e:
            print("Failed to load sitemap:", e)
            return

        print("Starting concurrent URL crawler...")
        semaphore = asyncio.Semaphore(50)  # Limit to 50 concurrent requests
        
        tasks = [fetch_page(session, url, semaphore) for url in urls]
        
        # Give progress updates
        total = len(tasks)
        results = []
        for i, coro in enumerate(asyncio.as_completed(tasks)):
            res = await coro
            results.append(res)
            if (i+1) % 100 == 0 or (i+1) == total:
                print(f"Processed {i+1}/{total} URLs...")

    mapping = {}
    success = 0
    for url, sku in results:
        if sku:
            mapping[sku.strip().lower()] = url
            success += 1
            
    print(f"Successfully scraped {success} reliable SKUs out of {len(results)} URLs")
    
    with open(OUTPUT_MAP_FILE, 'w') as f:
        json.dump(mapping, f, indent=2)
        
    print(f"URL Map saved to {OUTPUT_MAP_FILE}")
    
if __name__ == "__main__":
    t0 = time.time()
    asyncio.run(main())
    print(f"Total time: {time.time()-t0:.1f}s")
