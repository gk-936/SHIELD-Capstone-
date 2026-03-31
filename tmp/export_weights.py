import joblib
import numpy as np

def export_to_header(path, output_path):
    print(f"Exporting production logic from {path}...")
    full_data = joblib.load(path)
    # The refined model stores everything in a 'council' nested dict
    data = full_data['council'] if 'council' in full_data else full_data
    
    with open(output_path, 'w') as f:
        f.write("#ifndef MODEL_WEIGHTS_H\n#define MODEL_WEIGHTS_H\n\n")
        f.write("#include <stdint.h>\n\n")
        
        # 1. Thresholds
        med_t = data.get('threshold_medium', data.get('threshold', 0.5))
        high_t = data.get('threshold_high', 0.6)
        f.write(f"const float THRESHOLD_SUSPICIOUS = {med_t:.6f}f;\n")
        f.write(f"const float THRESHOLD_RANSOMWARE = {high_t:.6f}f;\n\n")
        
        # 2. Ensemble Weights
        weights = data['best_weights']
        f.write(f"const float ENSEMBLE_WEIGHTS[{len(weights)}] = {{")
        f.write(", ".join([f"{w:.4f}f" for w in weights]))
        f.write("};\n\n")
        
        # 3. Features & Scalers
        s_feat = data['storage_features']
        m_feat = data['memory_features']
        f.write(f"#define STORAGE_FEAT_COUNT {len(s_feat)}\n")
        f.write(f"#define MEMORY_FEAT_COUNT {len(m_feat)}\n\n")
        
        f.write("const float SCALER_S_CENTER[] = {" + ", ".join([f"{c:.6f}f" for c in data['scaler_storage'].center_]) + "};\n")
        f.write("const float SCALER_S_SCALE[] = {" + ", ".join([f"{s:.6f}f" for s in data['scaler_storage'].scale_]) + "};\n")
        f.write("const float SCALER_M_CENTER[] = {" + ", ".join([f"{c:.6f}f" for c in data['scaler_memory'].center_]) + "};\n")
        f.write("const float SCALER_M_SCALE[] = {" + ", ".join([f"{s:.6f}f" for s in data['scaler_memory'].scale_]) + "};\n\n")
        
        # 4. Normalizers
        norm_dict = data['normalizers']
        f.write("struct Normalizer { float min; float scale; };\n")
        f.write("const Normalizer MODEL_NORMALIZERS[] = {\n")
        for name in data['model_names']:
            norm = norm_dict[name]
            f.write(f"    {{ {norm.min_[0]:.6f}f, {norm.scale_[0]:.6f}f }}, // {name}\n")
        f.write("};\n\n")
        
        # 5. Isolation Forest Trees
        f.write("struct IFNode { int16_t feature; float threshold; int16_t left; int16_t right; };\n\n")
        
        def export_if(model_key, prefix):
            if model_key in data:
                print(f"Processing trees for {model_key}...")
                clf = data[model_key]
                # Export 30 trees per model
                num_trees = min(30, len(clf.estimators_))
                f.write(f"#define {prefix}_TREE_COUNT {num_trees}\n")
                for i in range(num_trees):
                    tree = clf.estimators_[i].tree_
                    f.write(f"const IFNode {prefix}_TREE_{i}[] = {{\n")
                    for n in range(tree.node_count):
                        f.write(f"    {{ {tree.feature[n]}, {tree.threshold[n]:.6f}f, {tree.children_left[n]}, {tree.children_right[n]} }},\n")
                    f.write("};\n\n")
                
                f.write(f"const IFNode* const {prefix}_TREES[] = {{\n")
                for i in range(num_trees): f.write(f"    {prefix}_TREE_{i},\n")
                f.write("};\n\n")
        
        export_if('IF_storage', 'IF_S')
        export_if('IF_memory', 'IF_M')

        f.write("#endif // MODEL_WEIGHTS_H\n")
    print(f"Header generated at {output_path}")

if __name__ == "__main__":
    export_to_header('final_hybrid_v2.pkl', 'backend/shield/daemon/engine/model_weights.h')
