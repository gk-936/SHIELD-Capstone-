import pandas as pd
import os

files = ['ransmap_features_v2.parquet', 'ransmap_features_v3.parquet']

for f in files:
    if os.path.exists(f):
        try:
            df = pd.read_parquet(f)
            print(f"--- {f} ---")
            print(f"Total Columns: {len(df.columns)}")
            print(sorted(df.columns.tolist()))
            print("\n")
        except Exception as e:
            print(f"Error reading {f}: {e}")
    else:
        print(f"File not found: {f}")
