import joblib
import numpy as np
import os

def export_to_header(path, output_path):
    print(f"Exporting optimized model from {path}...")
    if not os.path.exists(path):
        print("Error: Model file not found.")
        return
        
    data = joblib.load(path)
    
    with open(output_path, 'w') as f:
        f.write("#ifndef MODEL_WEIGHTS_H\n#define MODEL_WEIGHTS_H\n\n")
        f.write("#include <stdint.h>\n\n")
        
        # 1. Thresholds
        raw_t = data['threshold']
        f.write(f"const float THRESHOLD_SUSPICIOUS = {raw_t * 0.8:.6f}f; // Heuristic\n")
        f.write(f"const float THRESHOLD_RANSOMWARE = {raw_t:.6f}f;\n\n")
        
        # 2. Ensemble Weights
        weights = data['weights']
        f.write(f"const float ENSEMBLE_WEIGHTS[{len(weights)}] = {{")
        f.write(", ".join([f"{w:.4f}f" for w in weights]))
        f.write("};\n\n")
        
        # 3. Scaler (Unified 26-feature RobustScaler)
        scaler = data['scaler']
        f.write("const float SCALER_CENTER[] = {" + ", ".join([f"{c:.6f}f" for c in scaler.center_]) + "};\n")
        f.write("const float SCALER_SCALE[] = {" + ", ".join([f"{s:.6f}f" for s in scaler.scale_]) + "};\n\n")
        
        # 4. Normalizers (MinMaxScaler per model)
        # Order: IF_S, IF_M, IF_F, HBOS, LOF, IF_D
        model_names = ["IF_storage", "IF_memory", "IF_full", "hbos", "lof", "IF_diverse"]
        norm_dict = data['normalizers']
        f.write("struct Normalizer { float min; float scale; };\n")
        f.write("const Normalizer MODEL_NORMALIZERS[] = {\n")
        for name in model_names:
            norm = norm_dict[name]
            f.write(f"    {{ {norm.min_[0]:.6f}f, {norm.scale_[0]:.6f}f }}, // {name}\n")
        f.write("};\n\n")
        
        # 5. Isolation Forest Trees
        f.write("struct IFNode { int16_t feature; float threshold; int16_t left; int16_t right; };\n\n")
        
        def export_if(model_key, prefix):
            if model_key in data:
                print(f"Processing trees for {model_key}...")
                clf = data[model_key]
                # Export 20 trees per model to keep header size manageable
                num_trees = min(20, len(clf.estimators_))
                f.write(f"#define {prefix}_TREE_COUNT {num_trees}\n")
                for i in range(num_trees):
                    tree = clf.estimators_[i].tree_
                    f.write(f"const IFNode {prefix}_TREE_{i}[] = {{\n")
                    for n in range(tree.node_count):
                        feat = tree.feature[n]
                        # Leaf nodes have feature -2
                        # Children_left/right are indices
                        f.write(f"    {{ {feat}, {tree.threshold[n]:.6f}f, {tree.children_left[n]}, {tree.children_right[n]} }},\n")
                    f.write("};\n\n")
                
                f.write(f"const IFNode* const {prefix}_TREES[] = {{\n")
                for i in range(num_trees): f.write(f"    {prefix}_TREE_{i},\n")
                f.write("};\n\n")
        
        export_if('if_storage', 'IF_S')
        export_if('if_memory', 'IF_M')
        export_if('if_full', 'IF_FULL')
        export_if('if_diverse', 'IF_DIVERSE')

        f.write("#endif // MODEL_WEIGHTS_H\n")
    print(f"Header generated at {output_path}")

if __name__ == "__main__":
    # Ensure relative paths are correct if running from project root
    export_to_header('scripts/council_v4_ransmap.pkl', 'backend/shield/daemon/engine/model_weights.h')
