import pandas as pd
import os
import glob

def inspect_parquet_files():
    print("=== SHIELD Parquet Dataset Inspection ===")
    
    # Find all parquet files in the current directory and subdirectories
    parquet_files = glob.glob("**/*.parquet", recursive=True)
    
    if not parquet_files:
        print("No .parquet files found in the workspace.")
        return

    for file_path in sorted(parquet_files):
        print(f"\n--- {os.path.basename(file_path)} ---")
        print(f"Path: {file_path}")
        try:
            df = pd.read_parquet(file_path)
            print(f"Rows: {len(df)}")
            print(f"Columns Count: {len(df.columns)}")
            
            # Show the first 10 columns to identify the feature set
            cols = list(df.columns)
            print(f"First 10 Features: {cols[:10]}")
            
            # Specifically check for the 'missing' features we identified in the notebook
            missing_features = ['write_size_uniformity', 'entropy_access_rate_ratio', 'sequential_ratio']
            found_missing = [f for f in missing_features if f in cols]
            
            if len(found_missing) == len(missing_features):
                print("Status: 27-Feature Dataset (Production Ready)")
            elif len(cols) < 20:
                print("Status: 16-Feature Dataset (Legacy/V1)")
            else:
                print(f"Status: Intermediate Dataset ({len(found_missing)}/3 key features found)")
                
        except Exception as e:
            print(f"Error reading file: {e}")

if __name__ == "__main__":
    inspect_parquet_files()
