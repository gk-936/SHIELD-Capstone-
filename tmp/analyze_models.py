import json
import re

def analyze_notebook(path):
    with open(path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    print(f"Total cells: {len(nb['cells'])}")
    targets = ['council_detector.pkl', 'council_v3.pkl', 'final_hybrid_v2.pkl', 'hybrid_detector.pkl']
    
    results = {}
    for i, cell in enumerate(nb['cells']):
        source = cell.get('source', '')
        if isinstance(source, list): source = "".join(source)
        
        for target in targets:
            if target in source:
                if target not in results: results[target] = ""
                outputs = cell.get('outputs', [])
                for out in outputs:
                    if out.get('output_type') == 'stream':
                        text = out.get('text', '')
                        if isinstance(text, list): text = "".join(text)
                        results[target] += (text + "\n")

    for model, full_text in results.items():
        print(f"\n===== MODEL: {model} =====")
        # Try to find specific summary block
        metrics = re.findall(r"(Val F1|Val AUC|Val Recall|Extra AUC|Variants|Ryuk Detection|Darkside Detect)\s*:\s*([\d\.%]+)", full_text)
        if metrics:
            for k, v in metrics:
                print(f"  {k:20}: {v}")
        else:
            print("  (No direct metrics summary found in this cell's output)")

if __name__ == "__main__":
    analyze_notebook('notebook99b11b917e.ipynb')
