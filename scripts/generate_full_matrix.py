#!/usr/bin/env python3
import json
from collections import defaultdict

with open('data/grace_products_clean.json') as f:
    products = json.load(f)

# Group products
components_keys = ['Cap', 'Cap/Closure', 'Roll-On Cap', 'Sprayer', 'Dropper', 'Applicator Closures', 'Component']
components = [p for p in products if p.get('family') in components_keys]
bottles = [p for p in products if p.get('family') not in components_keys and p.get('family')]

# By Family -> List of distinct Bottle Types (based on thread and type)
# We will define a Bottle Group by: Capacity + Neck Thread Size + Is_RollOn
family_groups = defaultdict(list)

for b in bottles:
    fam = b.get('family', 'Unknown')
    thread = b.get('neckThreadSize') or 'No Thread'
    cap = b.get('capacity') or 'Unknown Capacity'
    name = (b.get('itemName') or '').lower()
    desc = (b.get('itemDescription') or '').lower()
    
    is_rollon = 'roll' in name or 'roll' in desc or 'roll' in fam.lower()
    
    # Store unique configurations per family
    config = {
        'capacity': cap,
        'thread': thread,
        'is_rollon': is_rollon
    }
    if config not in family_groups[fam]:
        family_groups[fam].append(config)

# Pre-compute components by thread AND type
comp_by_thread_std = defaultdict(lambda: defaultdict(int))
comp_by_thread_ro = defaultdict(lambda: defaultdict(int))

for c in components:
    th = c.get('neckThreadSize') or 'No Thread'
    fam = c.get('family')
    
    if fam == 'Roll-On Cap':
        comp_by_thread_ro[th][fam] += 1
    else:
        comp_by_thread_std[th][fam] += 1

html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Best Bottles - Ultimate Family Fitment Matrix</title>
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
            background-color: #f0f2f5;
            color: #333;
            margin: 0;
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        h1 { font-size: 2.8rem; margin-bottom: 10px; color: #1a1a1a; text-align: center; }
        .subtitle { font-size: 1.2rem; color: #555; margin-bottom: 50px; text-align: center; max-width: 800px; }
        .family-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.06);
            padding: 40px;
            margin-bottom: 40px;
            width: 100%;
            max-width: 1200px;
            overflow-x: auto;
        }
        .family-title {
            font-size: 2rem;
            font-weight: 700;
            color: #1a365d;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #edf2f7;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .family-title span { background: #ebf8ff; color: #3182ce; font-size: 1rem; padding: 6px 14px; border-radius: 20px; font-weight: 600; }
        .mermaid { display: flex; justify-content: center; margin-top: 20px; }
    </style>
</head>
<body>

    <h1>Ultimate Bottle Architecture Matrix</h1>
    <div class="subtitle">Complete catalog mapping of every bottle shape, capacity, and thread size to its universally compatible components.</div>
"""

for fam in sorted(family_groups.keys()):
    configs = family_groups[fam]
    html += f'\n<div class="family-card">\n<div class="family-title">🍾 {fam} Family <span>{len(configs)} Variations</span></div>\n<div class="mermaid">\ngraph LR\n'
    html += f'  FAM["<b>{fam} Bottles</b>"]\n'
    
    # Group by Thread and Is-Rollon to avoid massive clutter
    # thread -> whether it's rollon -> capacities
    grouped_nodes = defaultdict(lambda: defaultdict(list))
    for c in configs:
        grouped_nodes[c['thread']][c['is_rollon']].append(c['capacity'])
        
    i = 0
    for thread, target_types in grouped_nodes.items():
        for is_ro, caps in target_types.items():
            i += 1
            node_id = f"N_{fam.replace(' ', '')}_{i}"
            
            # Format capacities nicely
            caps_str = "<br/>".join(sorted(set(caps)))
            bottle_type = "Roll-On Style" if is_ro else "Standard Style"
            
            html += f'  {node_id}["<b>{thread} Thread</b><br/><i>{bottle_type}</i><br/>{caps_str}"]\n'
            html += f'  FAM --> {node_id}\n'
            
            # Get matching components based on type and thread
            has_comps = False
            
            if is_ro:
                comp_counts = comp_by_thread_ro.get(thread, {})
                ro_caps = comp_counts.get('Roll-On Cap', 0)
                if ro_caps > 0:
                    ro_id = f"{node_id}_RO"
                    html += f'  {ro_id}["Roll-On Caps<br/>({ro_caps} Variants)"]\n'
                    html += f'  {node_id} ===|Fits| {ro_id}\n'
                    html += f'  style {ro_id} fill:#faf5ff,stroke:#805ad5,stroke-width:2px\n'
                    has_comps = True
            else:
                comp_counts = comp_by_thread_std.get(thread, {})
                std_caps = comp_counts.get('Cap', 0) + comp_counts.get('Cap/Closure', 0)
                sprayers = comp_counts.get('Sprayer', 0)
                droppers = comp_counts.get('Dropper', 0)
                app = comp_counts.get('Applicator Closures', 0)
                
                if std_caps > 0:
                    c_id = f"{node_id}_CAP"
                    html += f'  {c_id}["Standard Caps<br/>({std_caps} Variants)"]\n'
                    html += f'  {node_id} ===|Fits| {c_id}\n'
                    html += f'  style {c_id} fill:#f0fff4,stroke:#38a169,stroke-width:2px\n'
                    has_comps = True
                if sprayers > 0:
                    s_id = f"{node_id}_SPR"
                    html += f'  {s_id}["Sprayers<br/>({sprayers} Variants)"]\n'
                    html += f'  {node_id} ===|Fits| {s_id}\n'
                    html += f'  style {s_id} fill:#e6fffa,stroke:#319795,stroke-width:2px\n'
                    has_comps = True
                if droppers > 0:
                    d_id = f"{node_id}_DRP"
                    html += f'  {d_id}["Droppers<br/>({droppers} Variants)"]\n'
                    html += f'  {node_id} ===|Fits| {d_id}\n'
                    html += f'  style {d_id} fill:#fffff0,stroke:#d69e2e,stroke-width:2px\n'
                    has_comps = True
                if app > 0:
                    a_id = f"{node_id}_APP"
                    html += f'  {a_id}["Applicators<br/>({app} Variants)"]\n'
                    html += f'  {node_id} ===|Fits| {a_id}\n'
                    html += f'  style {a_id} fill:#fff5f5,stroke:#e53e3e,stroke-width:2px\n'
                    has_comps = True
                    
            if not has_comps:
                no_id = f"{node_id}_NO"
                html += f'  {no_id}["No Compatible<br/>Tops Found"]\n'
                html += f'  {node_id} -.- {no_id}\n'
                html += f'  style {no_id} fill:#gray,stroke:#333,stroke-dasharray: 5 5\n'

            html += f'  style {node_id} fill:#f7fafc,stroke:#4a5568,stroke-width:1px\n'
            
    html += '</div>\n</div>\n'

html += "</body></html>"
with open('docs/ultimate_fitment_matrix.html', 'w') as f:
    f.write(html)
print("Created ultimate_fitment_matrix.html")
