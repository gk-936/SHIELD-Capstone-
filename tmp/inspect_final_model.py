import joblib

def inspect_model(path):
    print(f"Inspecting {path}...")
    model_data = joblib.load(path)
    
    if isinstance(model_data, dict):
        print("Model consists of a dictionary with keys:")
        for k, v in model_data.items():
            print(f"  - {k}: {type(v)}")
            if hasattr(v, 'get_params'):
                print(f"    Params: {v.get_params()}")
            if k in ['best_weights', 'threshold', 'threshold_high', 'threshold_medium']:
                print(f"    Value: {v}")
    else:
        print(f"Model is of type: {type(model_data)}")

if __name__ == "__main__":
    inspect_model('final_hybrid_v2.pkl')
