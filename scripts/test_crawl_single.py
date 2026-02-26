import requests
from bs4 import BeautifulSoup
import re

url = "https://www.bestbottles.com/product/cylinder-style-28-ml-glass-bottle-plastic-roll-on-and-black-cap"

def fetch_and_parse(url):
    print(f"Fetching: {url}")
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers)
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    data = {}
    data['productUrl'] = url
    
    # 1. Item Name (Website SKU)
    # usually inside a <p><strong>Item Name:</strong> GBCyl28RollBlk</p>
    p_tags = soup.find_all('p')
    for p in p_tags:
        text = p.get_text(separator=' ', strip=True)
        if 'Item Name:' in text:
            # extract string after Item Name:
            match = re.search(r'Item Name:\s*([^\s<]+)', text)
            if match:
                data['websiteSku'] = match.group(1).strip()
        if 'Item Description:' in text:
            match = re.search(r'Item Description:\s*(.*)', text)
            if match:
                data['itemDescription'] = match.group(1).strip()
        if 'Item Capacity:' in text or 'Item capacity:' in text:
            match = re.search(r'Item [Cc]apacity:\s*([^<]*)', text)
            if match:
                data['capacity'] = match.group(1).strip()
        if 'Item Height with Cap:' in text:
            match = re.search(r'Item Height with Cap:\s*([^\s<]+)', text)
            if match:
                data['heightWithCap'] = match.group(1).strip()
        if 'Item Height without Cap:' in text:
            match = re.search(r'Item Height without Cap:\s*([^\s<]+)', text)
            if match:
                data['heightWithoutCap'] = match.group(1).strip()
        if 'Item Diameter:' in text or 'Item diameter:' in text:
            match = re.search(r'Item [Dd]iameter:\s*([^\s<]+)', text)
            if match:
                data['diameter'] = match.group(1).strip()
        if 'Closure Type:' in text or 'Closure:' in text:
            match = re.search(r'Closure(?: Type)?:\s*([^<]*)', text)
            if match:
                data['closureType'] = match.group(1).strip()
        if 'Neck Thread Size:' in text or 'Neck Thread size:' in text or 'Neck size:' in text:
            match = re.search(r'Neck (?:Thread )?[Ss]ize:\s*([^\s<]+)', text)
            if match:
                data['neckThreadSize'] = match.group(1).strip()
                
    # 2. Main title
    title_div = soup.find('div', class_='prdDetTitle')
    if title_div and title_div.h1:
        data['itemName'] = title_div.h1.get_text(strip=True)
    elif soup.title:
        data['itemName'] = soup.title.get_text(strip=True)
        
    # 3. Prices
    # BestBottles uses a table for pricing often
    tables = soup.find_all('table')
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            text = row.get_text(separator=' ', strip=True).lower()
            if '1 pcs' in text or '1 pc' in text:
                price = re.search(r'\$\s*([0-9.]+)', text)
                if price:
                    data['price1pc'] = float(price.group(1))
            if '10 pcs' in text or '10 pc' in text:
                price = re.search(r'\$\s*([0-9.]+)', text)
                if price:
                    data['price10pc'] = float(price.group(1))
            if '12 pcs' in text or '12 pc' in text:
                price = re.search(r'\$\s*([0-9.]+)', text)
                if price:
                    data['price12pc'] = float(price.group(1))
                    
    # Also look at selects if options have prices
    selects = soup.find_all('select')
    for select in selects:
        for option in select.find_all('option'):
            text = option.get_text(strip=True).lower()
            if '1 pcs' in text or '1 pc' in text:
                price = re.search(r'\$\s*([0-9.]+)', text)
                if price:
                    data['price1pc'] = float(price.group(1))
            
    # 4. Images
    # find images in div class item active or similar
    main_img = soup.find('img', id="magnifyImg")
    if main_img:
        data['imageUrl'] = main_img.get('src')
    else:
        # fallback to active carousel item
        active_item = soup.find('div', class_='item active')
        if active_item and active_item.img:
            data['imageUrl'] = active_item.img.get('src')
        else:
            # find first large product image
            imgs = soup.find_all('img')
            for img in imgs:
                src = img.get('src', '')
                if 'store/' in src and (src.endswith('.jpg') or src.endswith('.png') or src.endswith('.gif')):
                    data['imageUrl'] = src
                    break
    
    import pprint
    pprint.pprint(data)

fetch_and_parse(url)
