import pandas as pd

def inspect_parquet(file_path):
    try:
        # Load the Parquet file
        df = pd.read_parquet(file_path)

        print(f"--- Inspection Report for: {file_path} ---")
        
        # 1. Show basic info (Columns, Data Types, Memory Usage)
        print("\n[1] File Metadata & Schema:")
        print(df.info())

        # 2. Show the first few rows
        print("\n[2] First 5 Rows:")
        print(df.head())

        # 3. Statistical summary (helpful for numerical logs or metrics)
        print("\n[3] Statistical Summary:")
        print(df.describe())

        # 4. Check for missing values
        print("\n[4] Missing Values Count:")
        print(df.isnull().sum())

        # 5. Shape of the data
        print(f"\nTotal Rows: {df.shape[0]}")
        print(f"Total Columns: {df.shape[1]}")

    except Exception as e:
        print(f"Error reading the file: {e}")

if __name__ == "__main__":
    # Replace 'your_data.parquet' with your actual filename
    target_file = 'ransmap_features_v3.parquet' 
    inspect_parquet(target_file)