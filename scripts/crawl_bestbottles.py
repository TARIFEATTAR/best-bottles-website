import asyncio
import aiohttp
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import re
import sys
import time
import json
import os

SITEMAP_URL = "https://www.bestbottles.com/sitemap.xml"
OUTPUT_FILE = "data/bestbottles_raw_website_data.json"

async def fetch_and_parse(session, url, semaphore):
    async with semaphore:
        for attempt in range(3):
            try:
                # Add delay to avoid hammering server (1 second)
                await asyncio.sleep(1)
                
                async with session.get(url, timeout=15) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        data = {'productUrl': url}
                        
                        # Extract from text fields
                        for p in soup.find_all(['p', 'div', 'span', 'li']):
                            text = p.get_text(separator=' ', strip=True)
                            if 'Item Name:' in text:
                                m = re.search(r'Item Name:\s*([^\s<]+)', text)
                                if m: data['websiteSku'] = m.group(1).strip()
                            if 'Item Description:' in text:
                                m = re.search(r'Item Description:\s*(.*)', text)
                                if m: data['itemDescription'] = m.group(1).strip()
                            if 'Item Capacity:' in text or 'Item capacity:' in text:
                                m = re.search(r'Item [Cc]apacity:\s*([^<]*)', text, re.IGNORECASE)
                                if m: data['capacity'] = m.group(1).strip()
                            if 'Item Height with Cap:' in text or 'Height with Cap:' in text:
                                m = re.search(r'Height with Cap:\s*([^\s<]+)', text, re.IGNORECASE)
                                if m: data['heightWithCap'] = m.group(1).strip()
                            if 'Item Height without Cap:' in text or 'Height without Cap:' in text:
                                m = re.search(r'Height without Cap:\s*([^\s<]+)', text, re.IGNORECASE)
                                if m: data['heightWithoutCap'] = m.group(1).strip()
                            if 'Item Diameter:' in text or 'Item diameter:' in text or 'Diameter:' in text:
                                m = re.search(r'[Dd]iameter:\s*([^\s<]+)', text)
                                if m: data['diameter'] = m.group(1).strip()
                            if 'Closure Type:' in text or 'Closure:' in text:
                                m = re.search(r'Closure(?: Type)?:\s*([^<]*)', text, re.IGNORECASE)
                                if m: data['closureType'] = m.group(1).strip()
                            if 'Neck Thread Size:' in text or 'Neck size:' in text or 'Thread size:' in text:
                                m = re.search(r'(?:Neck|Thread).*?[Ss]ize:\s*([^\s<]+)', text, re.IGNORECASE)
                                if m: data['neckThreadSize'] = m.group(1).strip()

                        # Prices can be tricky, find any price blocks
                        price_texts = soup.find_all(string=re.compile(r'\$'))
                        for text in price_texts:
                            s = text.parent.get_text(separator=' ', strip=True).lower()
                            if '1 pc' in s or '1pc' in s or 'each' in s:
                                m = re.search(r'\$\s*([0-9.]+)', s)
                                if m: data['price1pc'] = float(m.group(1))
                            if '10 pc' in s or '10pc' in s:
                                m = re.search(r'\$\s*([0-9.]+)', s)
                                if m: data['price10pc'] = float(m.group(1))
                            if '12 pc' in s or '12pc' in s or 'dozen' in s:
                                m = re.search(r'\$\s*([0-9.]+)', s)
                                if m: data['price12pc'] = float(m.group(1))
                                
                        # Prices in dropdown options
                        for opt in soup.find_all('option'):
                            opt_text = opt.get_text(strip=True).lower()
                            if '$' in opt_text:
                                m = re.search(r'\$\s*([0-9.]+)', opt_text)
                                if m:
                                    if '10 pc' in opt_text:
                                        data['price10pc'] = float(m.group(1))
                                    elif '12 pc' in opt_text or 'dozen' in opt_text:
                                        data['price12pc'] = float(m.group(1))
                                    else:
                                        # Assume 1 pc if not explicitly 10/12
                                        if 'price1pc' not in data:
                                            data['price1pc'] = float(m.group(1))
                        
                        # itemName
                        title_div = soup.find('div', class_='prdDetTitle')
                        if title_div and title_div.h1:
                            data['itemName'] = title_div.h1.get_text(strip=True)
                        elif soup.title:
                            data['itemName'] = soup.title.get_text(strip=True)

                        # image URL
                        for img in soup.find_all('img'):
                            src = img.get('src')
                            if src and ('store/enlarged_pics/' in src or 'store/capped/' in src):
                                data['imageUrl'] = "https://www.bestbottles.com" + src.replace('..', '')
                                break

                        # ensure websiteSku exists as fallback from filename if missing
                        if 'websiteSku' not in data and 'imageUrl' in data:
                            filename = data['imageUrl'].split('/')[-1]
                            base_sku = filename.split('.')[0]
                            if base_sku and len(base_sku) > 3:
                                data['websiteSku'] = base_sku

                        # We only want items that have a sku, otherwise it's probably not a product
                        if 'websiteSku' in data:
                            return data
                        return None

                    else:
                        return None
            except Exception as e:
                if attempt == 2:
                    return None
                await asyncio.sleep(2)

async def main():
    print(f"Fetching sitemap {SITEMAP_URL}...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    async with aiohttp.ClientSession(headers=headers) as session:
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

        print("Starting slow, polite crawler (1 request/sec)...")
        # Throttle to 3 concurrent connections max, combined with 1s sleep per request above = max ~3 requests/sec
        semaphore = asyncio.Semaphore(3)  
        
        tasks = [fetch_and_parse(session, url, semaphore) for url in urls]
        
        total = len(tasks)
        results = []
        for i, coro in enumerate(asyncio.as_completed(tasks)):
            res = await coro
            if res:
                results.append(res)
                
            if (i+1) % 50 == 0 or (i+1) == total:
                print(f"[{i+1}/{total}] Retrieved data, saving intermediate file...")
                with open(OUTPUT_FILE, 'w') as f:
                    json.dump(results, f, indent=2)

    print(f"Scraping complete. Saved {len(results)} valid products to {OUTPUT_FILE}")

if __name__ == "__main__":
    t0 = time.time()
    asyncio.run(main())
    print(f"Total time: {time.time()-t0:.1f}s")
