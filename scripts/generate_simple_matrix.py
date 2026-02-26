#!/usr/bin/env python3
import json
from collections import defaultdict

with open('data/grace_products_clean.json') as f:
    products = json.load(f)

# Hardcode component families to categorize correctly
components_keys = ['Cap', 'Cap/Closure', 'Roll-On Cap', 'Sprayer', 'Dropper', 'Applicator Closures', 'Component']
components = [p for p in products if p.get('family') in components_keys]
bottles = [p for p in products if p.get('family') not in components_keys and p.get('family')]

# Organize bottles by Family
families = defaultdict(list)
for b in bottles:
    fam = b.get('family', 'Unknown')
    families[fam].append(b)

# Pre-parse components by thread and type (std vs roll-on)
comp_by_thread_std = defaultdict(lambda: defaultdict(list))
comp_by_thread_ro = defaultdict(lambda: defaultdict(list))

for c in components:
    th = c.get('neckThreadSize') or 'No Thread'
    fam = c.get('family')
    
    if fam == 'Roll-On Cap':
        comp_by_thread_ro[th][fam].append(c)
    else:
        # Group Caps and Cap/Closures together for simplicity
        if fam in ['Cap', 'Cap/Closure']:
            comp_by_thread_std[th]['Standard Caps'].append(c)
        else:
            comp_by_thread_std[th][fam].append(c)

html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Best Bottles - Simple Family Fitment Matrix</title>
    <!-- Include Mermaid.js -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({ 
            startOnLoad: true, 
            theme: 'default',
            securityLevel: 'loose'
        });
    </script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8f9fa;
            color: #333;
            margin: 0;
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        h1 { font-size: 2.5rem; margin-bottom: 10px; color: #1a1a1a; text-align: center; }
        .subtitle { font-size: 1.1rem; color: #666; margin-bottom: 50px; text-align: center; max-width: 800px; }
        .family-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
            padding: 40px;
            margin-bottom: 40px;
            width: 100%;
            max-width: 900px;
        }
        .family-title {
            font-size: 2rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 20px;
            text-align: center;
        }
        .mermaid { display: flex; justify-content: center; }
    </style>
</head>
<body>

    <h1>Bottle Family Fitment Mapping</h1>
    <div class="subtitle">A simplified view showing exactly which components fit onto each bottle family.</div>
"""

for fam in sorted(families.keys()):
    bottle_list = families[fam]
    
    # Determine the threads and types for this family
    threads = set()
    is_ro = False
    for b in bottle_list:
        thread = b.get('neckThreadSize')
        if thread:
            threads.add(thread)
        name = (b.get('itemName') or '').lower()
        desc = (b.get('itemDescription') or '').lower()
        if 'roll' in name or 'roll' in desc or 'roll' in fam.lower():
            is_ro = True

    html += f'\n<div class="family-card">\n<div class="family-title">{fam} Family</div>\n<div class="mermaid">\ngraph LR\n'
    html += f'  BOT["<b>{fam} Bottles</b><br/>{len(bottle_list)} SKUs"]\n'
    
    # Calculate total components that fit this family
    fitted_components = defaultdict(int)
    for thread in threads:
        if is_ro:
            for c_fam, c_list in comp_by_thread_ro[thread].items():
                fitted_components[c_fam] += len(c_list)
        else:
            for c_fam, c_list in comp_by_thread_std[thread].items():
                fitted_components[c_fam] += len(c_list)
    
    if not fitted_components:
        html += f'  NO["No specific components mapped yet"]\n'
        html += f'  BOT -.- NO\n'
        html += f'  style BOT fill:#f8f9fa,stroke:#ccc,stroke-width:2px\n'
        html += f'  style NO fill:#f8f9fa,stroke:#ccc,stroke-dasharray: 5 5\n'
    else:
        # Style the main bottle node
        html += f'  style BOT fill:#e1f5fe,stroke:#0288d1,stroke-width:2px\n'
        
        i = 0
        for c_fam, count in fitted_components.items():
            i += 1
            node_id = f"COMP_{i}"
            html += f'  {node_id}["<b>{c_fam}</b><br/>{count} options"]\n'
            html += f'  BOT === {node_id}\n'
            
            # Color code based on component type
            if 'Cap' in c_fam and 'Roll' not in c_fam:
                html += f'  style {node_id} fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px\n'
            elif 'Sprayer' in c_fam:
                html += f'  style {node_id} fill:#e0f7fa,stroke:#00838f,stroke-width:1px\n'
            elif 'Dropper' in c_fam:
                html += f'  style {node_id} fill:#fff8e1,stroke:#f57f17,stroke-width:1px\n'
            elif 'Roll' in c_fam:
                html += f'  style {node_id} fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px\n'
            else:
                html += f'  style {node_id} fill:#ffebee,stroke:#c62828,stroke-width:1px\n'

    html += '</div>\n</div>\n'

html += "</body></html>"
with open('docs/simple_family_matrix.html', 'w') as f:
    f.write(html)
print("Created simple_family_matrix.html successfully.")
