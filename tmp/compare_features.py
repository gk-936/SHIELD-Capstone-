import joblib
import pandas as pd
import os
import glob

def compare():
    print("=== FEATURE AVAILABILITY CHECK ===\n")

    # 1. Check PKL Model
    model_file = 'final_hybrid_v2.pkl'
    if os.path.exists(model_file):
        try:
            data = joblib.load(model_file)
            # Handle nested 'council' if present
            d = data.get('council', data)
            s_feat = d.get('storage_features', [])
            m_feat = d.get('memory_features', [])
            
            print(f"--- MODEL: {model_file} ---")
            print(f"Total Features: {len(s_feat) + len(m_feat)}")
            print(f"STORAGE ({len(s_feat)}): {s_feat}")
            print(f"MEMORY  ({len(m_feat)}): {m_feat}")
            print("-" * 40)
        except Exception as e:
            print(f"Error reading model: {e}")

    # 2. Check Parquet Files
    parquet_files = glob.glob("*.parquet")
    for pf in parquet_files:
        try:
            # We only read the first row to get columns quickly
            df = pd.read_parquet(pf)
            cols = list(df.columns)
            
            print(f"\n--- DATASET: {pf} ---")
            print(f"Total Columns: {len(cols)}")
            print(f"Columns: {cols}")
            
            # Check for the key differentiators
            target_set = ['write_size_uniformity', 'sequential_ratio', 'entropy_trend']
            missing = [f for f in target_set if f not in cols]
            if not missing:
                print(">> Status: FULL 27-FEATURE CAPABLE")
            else:
                print(f">> Status: INCOMPLETE (Missing: {missing})")
                
        except Exception as e:
                # If pyarrow/fastparquet missing, we can't read. 
                # But let's try a fallback or just report.
                print(f"\n--- DATASET: {pf} ---")
                print(f"(Cannot read file columns: {e})")

if __name__ == "__main__":
    compare()
