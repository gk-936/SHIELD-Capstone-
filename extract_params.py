import joblib, numpy as np, json, os

pkl_file = 'shield_hybrid_engine.pkl'
if not os.path.exists(pkl_file):
    print(f"Error: {pkl_file} not found")
    exit(1)

data = joblib.load(pkl_file)

def clean(obj):
    if isinstance(obj, (np.float64, np.float32, np.float16)):
        return float(obj)
    if isinstance(obj, (np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return clean(obj.tolist())
    if isinstance(obj, list):
        return [clean(x) for x in obj]
    if isinstance(obj, dict):
        return {str(k): clean(v) for k, v in obj.items()}
    return obj

output = {
    'S_CENTER': clean(data['s_scaler'].center_),
    'S_SCALE': clean(data['s_scaler'].scale_),
    'M_CENTER': clean(data['m_scaler'].center_),
    'M_SCALE': clean(data['m_scaler'].scale_),
    'G_CENTER': clean(data['g_scaler'].center_),
    'G_SCALE': clean(data['g_scaler'].scale_),
    'WEIGHTS': clean(data['metadata']['weights']),
    'L1_SCALERS': {k: [clean(v.min_[0]), clean(v.scale_[0])] for k, v in data['level1_score_scalers'].items()}
}

with open('tmp_model_params.json', 'w') as f:
    json.dump(output, f, indent=4)

print("Extracted parameters to tmp_model_params.json")
