import asyncio
import aiohttp
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import re
import json
import time

SITEMAP_URL = "https://www.bestbottles.com/sitemap.xml"
PASS1_FILE = "data/bestbottles_raw_website_data.json"
PASS2_FILE = "data/bestbottles_raw_website_pass2.json"

async def fetch_and_parse(session, url, semaphore):
    async with semaphore:
        for attempt in range(3):
            try:
                # Add delay to avoid hammering server
                await asyncio.sleep(1)
                
                async with session.get(url, timeout=20) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        data = {'productUrl': url}
                        
                        # We are logging why it failed in Pass 1 if it fails here again
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
                                        if 'price1pc' not in data:
                                            data['price1pc'] = float(m.group(1))
                        
                        title_div = soup.find('div', class_='prdDetTitle')
                        if title_div and title_div.h1:
                            data['itemName'] = title_div.h1.get_text(strip=True)
                        elif soup.title:
                            data['itemName'] = soup.title.get_text(strip=True)

                        for img in soup.find_all('img'):
                            src = img.get('src')
                            if src and ('store/enlarged_pics/' in src or 'store/capped/' in src):
                                data['imageUrl'] = "https://www.bestbottles.com" + src.replace('..', '')
                                break

                        if 'websiteSku' not in data and 'imageUrl' in data:
                            filename = data['imageUrl'].split('/')[-1]
                            base_sku = filename.split('.')[0]
                            if base_sku and len(base_sku) > 3:
                                data['websiteSku'] = base_sku

                        if 'websiteSku' in data:
                            return data
                        else:
                            # It's a valid 200 OM page, but absolutely NO SKU was found.
                            print(f"[NO_SKU_FOUND] {url}")
                            # Let's see if there's any text on the page at all to know if it's a 404 disguised as a 200
                            body_text = soup.get_text(strip=True)
                            if "not found" in body_text.lower() or "page you requested" in body_text.lower():
                                print(f"  -> It looks like a disguised 404 page.")
                            return None

                    elif response.status == 404:
                        print(f"[404_NOT_FOUND] {url}")
                        return None
                    else:
                        print(f"[{response.status}_ERROR] {url}")
                        return None
            except Exception as e:
                if attempt == 2:
                    print(f"[TIMEOUT/EXCEPTION] {url}: {e}")
                    return None
                await asyncio.sleep(2)

async def main():
    print("Loading Pass 1 results...")
    with open(PASS1_FILE, 'r') as f:
        pass1_data = json.load(f)
        pass1_urls = {item['productUrl'] for item in pass1_data}
    
    print(f"Loading sitemap {SITEMAP_URL}...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    async with aiohttp.ClientSession(headers=headers) as session:
        async with session.get(SITEMAP_URL, timeout=20) as r:
            content = await r.read()
        
        root = ET.fromstring(content)
        all_urls = []
        for child in root:
            for sub in child:
                if 'loc' in sub.tag:
                    u = sub.text
                    if '/product/' in u:
                        all_urls.append(u)
                        
        missing_urls = [u for u in all_urls if u not in pass1_urls]
        print(f"Total Sitemap URLs: {len(all_urls)}")
        print(f"Successfully Scraped in Pass 1: {len(pass1_urls)}")
        print(f"Missing URLs to retry: {len(missing_urls)}\n")

        if not missing_urls:
            print("No missing URLs to retry!")
            return

        semaphore = asyncio.Semaphore(3)  
        tasks = [fetch_and_parse(session, url, semaphore) for url in missing_urls]
        
        results = []
        for coro in asyncio.as_completed(tasks):
            res = await coro
            if res:
                results.append(res)
                
        print(f"\nPass 2 complete. Recovered {len(results)} additional products.")
        if results:
            print(f"Merging and saving to {PASS1_FILE} (Overwriting!)")
            # We overwrite the original Pass 1 file to have the combined master
            combined_data = pass1_data + results
            with open(PASS1_FILE, 'w') as f:
                json.dump(combined_data, f, indent=2)
            print(f"Total Valid Products is now: {len(combined_data)}")

if __name__ == "__main__":
    t0 = time.time()
    asyncio.run(main())
    print(f"Total time for Pass 2: {time.time()-t0:.1f}s")
