import pandas as pd
import numpy as np

dataset_path = r"C:\Users\gokul D\CapstoneML\CapstoneML\ransmap_features_v2.parquet"
df = pd.read_parquet(dataset_path)

print("Split counts:")
print(df['split'].value_counts())

print("\nSplit vs Label counts:")
print(pd.crosstab(df['split'], df['label']))

print("\nCouncil Score stats (if I were to run it):")
# We don't have the models here, but we can see the feature ranges
