import json
import joblib
import numpy as np

def export_hybrid_to_cpp(pkl_path, xgb_json_path, header_path):
    print(f"Exporting Hybrid Shield v7.0 from {pkl_path}...")
    data = joblib.load(pkl_path)
    
    with open(xgb_json_path, 'r') as f:
        trees = json.load(f)
    
    with open(header_path, 'w') as f:
        f.write("#ifndef MODEL_WEIGHTS_H\n#define MODEL_WEIGHTS_H\n\n")
        f.write("#include <stdint.h>\n\n")
        
        # 1. Feature Map (Meta-Learn Needs 3 Raw Features)
        # mean_entropy, write_size_uniformity, entropy_trend
        f.write("#define META_RAW_FEAT_ENTROPY 3\n")
        f.write("#define META_RAW_FEAT_UNIFORMITY 16\n")
        f.write("#define META_RAW_FEAT_TREND 9\n\n")

        # 2. Level-1 Scalers
        s_scaler = data['s_scaler']
        m_scaler = data['m_scaler']
        # The user used the same scaler for s/m in the script export block but let's be safe
        f.write("const float SCALER_S_CENTER[] = {" + ", ".join([f"{c:.6f}f" for c in s_scaler.center_]) + "};\n")
        f.write("const float SCALER_S_SCALE[] = {" + ", ".join([f"{s:.6f}f" for s in s_scaler.scale_]) + "};\n")
        f.write("const float SCALER_M_CENTER[] = {" + ", ".join([f"{c:.6f}f" for c in m_scaler.center_]) + "};\n")
        f.write("const float SCALER_M_SCALE[] = {" + ", ".join([f"{s:.6f}f" for s in m_scaler.scale_]) + "};\n\n")

        # 3. Anomaly Scores Thresholds (for predict_proba simulation)
        # PyOD IF predict_proba is basically (raw_score - offset_) / (max_score - offset_)
        # We will simplify by exporting raw indices for C++
        
        # 4. IF Specialist Trees (Storage & Memory)
        f.write("struct IFNode { int16_t feature; float threshold; int16_t left; int16_t right; };\n\n")
        
        def export_if_model(model, prefix):
            # PyOD wraps sklearn IF in estimators_
            num_trees = min(20, len(model.estimators_))
            f.write(f"#define {prefix}_TREE_COUNT {num_trees}\n")
            for i in range(num_trees):
                t = model.estimators_[i].tree_
                f.write(f"const IFNode {prefix}_TREE_{i}[] = {{\n")
                for n in range(t.node_count):
                    f.write(f"    {{ {t.feature[n]}, {t.threshold[n]:.6f}f, {t.children_left[n]}, {t.children_right[n]} }},\n")
                f.write("};\n")
            f.write(f"const IFNode* const {prefix}_TREES[] = {{")
            f.write(", ".join([f"{prefix}_TREE_{i}" for i in range(num_trees)]))
            f.write("};\n\n")

        export_if_model(data['level1_models']['IF_storage'], "IF_S")
        export_if_model(data['level1_models']['IF_memory'], "IF_M")

        # 5. Level-2 Meta XGBoost
        f.write("struct XGBNode { int16_t feature; float val; int16_t left; int16_t right; };\n")
        f.write(f"#define XGB_TREE_COUNT {len(trees)}\n")
        
        for i, tree in enumerate(trees):
            nodes = []
            def walk(node):
                idx = len(nodes)
                nodes.append({}) # Placeholder
                if 'leaf' in node:
                    nodes[idx] = {"f": -1, "v": node['leaf'], "l": -1, "r": -1}
                else:
                    # f5 -> 5
                    f_idx = int(node['split'][1:])
                    # Recursively walk children
                    # Children in JSON are sorted by nodeid
                    left_id = walk(node['children'][0])
                    right_id = walk(node['children'][1])
                    nodes[idx] = {"f": f_idx, "v": node['split_condition'], "l": left_id, "r": right_id}
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
        f.write("#define THRESHOLD_SUSPICIOUS 0.3f\n")
        f.write("#endif\n")

    print(f"Header generated at {header_path}")

if __name__ == "__main__":
    export_hybrid_to_cpp('shield_hybrid_engine.pkl', 'xgb_model.json', 'backend/shield/daemon/engine/model_weights.h')
