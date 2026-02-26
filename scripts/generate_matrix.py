import json
from collections import defaultdict

with open('data/grace_products_clean.json') as f:
    products = json.load(f)

# Group products
bottles = [p for p in products if p.get('family') not in ['Cap', 'Cap/Closure', 'Roll-On Cap', 'Sprayer', 'Dropper', 'Applicator Closures', 'Component']]
components = [p for p in products if p.get('family') in ['Cap', 'Cap/Closure', 'Roll-On Cap', 'Sprayer', 'Dropper', 'Applicator Closures', 'Component']]

# 1. Cylinder 25ml
cyl_25 = next((b for b in bottles if b.get('family') == 'Cylinder' and '25' in str(b.get('capacity', '')) and 'ml' in str(b.get('capacity', ''))), None)
cyl_thread = cyl_25.get('neckThreadSize') if cyl_25 else "18-415"

# 2. Roll-on 5ml
ro_5 = next((b for b in bottles if 'roll' in str(b.get('family')).lower() and '5' in str(b.get('capacity', ''))), None)
ro_thread = ro_5.get('neckThreadSize') if ro_5 else "13-415"

# 3. Circle 100ml
cir_100 = next((b for b in bottles if b.get('family') == 'Circle' and '100' in str(b.get('capacity', '')) and 'ml' in str(b.get('capacity', ''))), None)
cir_thread = cir_100.get('neckThreadSize') if cir_100 else "18-415"

def get_compatible(thread, is_rollon=False):
    matches = defaultdict(int)
    for c in components:
        if c.get('neckThreadSize') == thread:
            fam = c.get('family')
            # Roll on bottles only take roll on caps
            if is_rollon:
                if 'roll' in str(fam).lower():
                    matches[fam] += 1
            else:
                if 'roll' not in str(fam).lower():
                    matches[fam] += 1
    return matches

comp_cyl = get_compatible(cyl_thread, is_rollon=False)
comp_ro = get_compatible(ro_thread, is_rollon=True)
comp_cir = get_compatible(cir_thread, is_rollon=False)

md = f"""# Best Bottles - Visual Product Fitment Matrix

Here is the architectural overview mapping our key bottle styles to their entire ecosystem of compatible components.

## Component Compatibility Matrix

| Bottle Type | Exact Thread Size | Compatible Caps | Compatible Sprayers | Compatible Droppers | Roll-On Caps | **Total Compatible Components** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Cylinder 25ml** | `{cyl_thread}` | {comp_cyl.get('Cap/Closure', 0) + comp_cyl.get('Cap', 0)} | {comp_cyl.get('Sprayer', 0)} | {comp_cyl.get('Dropper', 0)} | 0 | **{sum(comp_cyl.values())}** |
| **Circle 100ml** | `{cir_thread}` | {comp_cir.get('Cap/Closure', 0) + comp_cir.get('Cap', 0)} | {comp_cir.get('Sprayer', 0)} | {comp_cir.get('Dropper', 0)} | 0 | **{sum(comp_cir.values())}** |
| **Roll-On 5ml** | `{ro_thread}` | 0 | 0 | 0 | {comp_ro.get('Roll-On Cap', 0)} | **{sum(comp_ro.values())}** |

---

## Visual Architecture (Mermaid Chart)
*You can view this diagram in any Markdown viewer that supports Mermaid (like GitHub, Notion, or VS Code).*

```mermaid
mindmap
  root((Best Bottles<br/>Product Ecosystem))
    Standard Neck Bottles
      [18-415 Thread]
        Cylinder 25ml
        Circle 100ml
        ::icon(fas fa-flask)
        (Compatible Fitments 👇)
          Caps & Closures
            {comp_cyl.get('Cap/Closure', 0) + comp_cyl.get('Cap', 0)} SKU Options
            Colors: Black, Silver, Gold, Copper, Pink...
          Fine Mist Sprayers
            {comp_cyl.get('Sprayer', 0)} SKU Options
            Styles: Standard, Antique Bulb w/ Tassels
          Glass Droppers
            {comp_cyl.get('Dropper', 0)} SKU Options
            Bulbs: Silicon, Rubber, Metallic finishes
    Roll-On Bottles
      [13-415 Thread]
        Roll-On 5ml
        ::icon(fas fa-prescription-bottle)
        (Compatible Fitments 👇)
          Roll-On Caps & Plugs
            {comp_ro.get('Roll-On Cap', 0)} SKU Options
            Styles: Matte Silver, Shiny Gold, Dotted Black...
```

```mermaid
graph LR
    subgraph Bottles ["🍾 BOTTLE FAMILIES"]
        B1["Cylinder 25ml<br/>(18-415)"]
        B2["Circle 100ml<br/>(18-415)"]
        B3["Roll-On 5ml<br/>(13-415)"]
    end

    subgraph Standard18415 ["🟢 18-415 STANDARD FITMENTS"]
        F1["Caps / Closures<br/>({comp_cyl.get('Cap/Closure', 0) + comp_cyl.get('Cap', 0)} Variants)"]
        F2["Sprayers<br/>({comp_cyl.get('Sprayer', 0)} Variants)"]
        F3["Droppers<br/>({comp_cyl.get('Dropper', 0)} Variants)"]
    end

    subgraph Rollon13415 ["🟣 13-415 ROLL-ON FITMENTS"]
        F4["Roll-On Caps<br/>({comp_ro.get('Roll-On Cap', 0)} Variants)"]
    end

    B1 ---|Matches| Standard18415
    B2 ---|Matches| Standard18415
    B3 ---|Matches| Rollon13415
    
    style B1 fill:#f9f9f9,stroke:#333,stroke-width:2px
    style B2 fill:#f9f9f9,stroke:#333,stroke-width:2px
    style B3 fill:#e6f3ff,stroke:#0066cc,stroke-width:2px
    style Standard18415 fill:#e8f5e9,stroke:#2e7d32
    style Rollon13415 fill:#f3e5f5,stroke:#7b1fa2
```
"""

with open('docs/visual_fitment_matrix.md', 'w') as f:
    f.write(md)

print("Visual matrix built successfully!")
print(f"  Cylinder 25ml  -> {sum(comp_cyl.values())} parts")
print(f"  Circle 100ml   -> {sum(comp_cir.values())} parts")
print(f"  Roll-On 5ml    -> {sum(comp_ro.values())} parts")
