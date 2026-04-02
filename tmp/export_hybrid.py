import json
import joblib
import numpy as np

def export_hybrid_to_cpp(pkl_path, xgb_json_path, header_path):
    print(f"Exporting Hybrid Shield v7.1 from {pkl_path}...")
    data = joblib.load(pkl_path)
    
    with open(xgb_json_path, 'r') as f:
        trees = json.load(f)
    
    with open(header_path, 'w', encoding='utf-8') as f:
        f.write("#ifndef MODEL_WEIGHTS_H\n")
        f.write("#define MODEL_WEIGHTS_H\n\n")
        f.write("#include <stdint.h>\n\n")
        
        # 1. Feature Counts
        f.write("#define STORAGE_FEAT_COUNT 20\n")
        f.write("#define MEMORY_FEAT_COUNT 6\n\n")

        # 2. Raw Feature Indices used in Level-2 Meta
        f.write("#define META_RAW_FEAT_ENTROPY 3\n")
        f.write("#define META_RAW_FEAT_UNIFORMITY 16\n")
        f.write("#define META_RAW_FEAT_TREND 9\n\n")

        # 3. Scalers
        # The user's script used RobustScaler. We need center_ and scale_
        # Note: In our current async setup, the scaler is used IN PYTHON.
        # But we export these placeholders to satisfy C++ compilation for local fallback.
        scaler = data.get('scaler')
        if scaler:
            f.write("const float SCALER_CENTER[] = {" + ", ".join([f"{c:.6f}f" for c in scaler.center_]) + "};\n")
            f.write("const float SCALER_SCALE[] = {" + ", ".join([f"{s:.6f}f" for s in scaler.scale_]) + "};\n")
            # For backward compat with the old scaler loop in the user's C++ code
            f.write("const float SCALER_S_CENTER[] = {" + ", ".join([f"{c:.6f}f" for c in scaler.center_[:20]]) + "};\n")
            f.write("const float SCALER_S_SCALE[] = {" + ", ".join([f"{s:.6f}f" for s in scaler.scale_[:20]]) + "};\n")
            f.write("const float SCALER_M_CENTER[] = {" + ", ".join([f"{c:.6f}f" for c in scaler.center_[20:]]) + "};\n")
            f.write("const float SCALER_M_SCALE[] = {" + ", ".join([f"{s:.6f}f" for s in scaler.scale_[20:]]) + "};\n\n")

        # 4. Level-1: Isolation Forest Nodes
        f.write("struct IFNode { int16_t feature; float threshold; int16_t left; int16_t right; };\n\n")
        
        def export_if_model(model, prefix):
            # PyOD wraps sklearn IF in estimators_
            num_trees = min(10, len(model.estimators_))
            f.write(f"#define {prefix}_TREE_COUNT {num_trees}\n")
            for i in range(num_trees):
                t = model.estimators_[i].tree_
                f.write(f"const IFNode {prefix}_TREE_{i}[] = {{\n")
                for n in range(t.node_count):
                    feat = t.feature[n]
                    f.write(f"    {{ {feat}, {float(t.threshold[n]):.6f}f, {t.children_left[n]}, {t.children_right[n]} }},\n")
                f.write("};\n")
            f.write(f"const IFNode* const {prefix}_TREES[] = {{")
            f.write(", ".join([f"{prefix}_TREE_{i}" for i in range(num_trees)]))
            f.write("};\n\n")

        # Check if they exists
        if 'l1_models' in data:
            export_if_model(data['l1_models']['IF_s'], "IF_S")
            export_if_model(data['l1_models']['IF_m'], "IF_M")

        # 5. Level-2 Meta XGBoost
        f.write("struct XGBNode { int16_t feature; float val; int16_t left; int16_t right; };\n")
        f.write(f"#define XGB_TREE_COUNT {len(trees)}\n")
        
        for i, tree in enumerate(trees):
            nodes = []
            def walk(node):
                idx = len(nodes)
                nodes.append({}) # Placeholder
                if 'leaf' in node:
                    nodes[idx] = {"f": -1, "v": float(node['leaf']), "l": -1, "r": -1}
                else:
                    f_idx = int(node['split'][1:])
                    # DFS walk
                    left_id = walk(node['children'][0])
                    right_id = walk(node['children'][1])
                    nodes[idx] = {"f": f_idx, "v": float(node['split_condition']), "l": left_id, "r": right_id}
                return idx
            
            walk(tree)
            f.write(f"const XGBNode XGB_TREE_{i}[] = {{\n")
            for n in nodes:
                f.write(f"    {{ {n['f']}, {n['v']:.6f}f, {n['l']}, {n['r']} }},\n")
            f.write("};\n")
        
        f.write("const XGBNode* const XGB_TREES[] = {")
        f.write(", ".join([f"XGB_TREE_{i}" for i in range(len(trees))]))
        f.write("};\n\n")

        f.write("#define THRESHOLD_RANSOMWARE 0.5f\n")
        f.write("#define THRESHOLD_SUSPICIOUS 0.3f\n\n")
        f.write("#endif // MODEL_WEIGHTS_H\n")

    print(f"✅ Repaired weights header at {header_path}")

if __name__ == "__main__":
    # We'll try to export from the lite v3 model we just trained
    export_hybrid_to_cpp('shield_v7_1_lite.pkl', 'xgb_lite.json', 'backend/shield/daemon/engine/model_weights.h')
