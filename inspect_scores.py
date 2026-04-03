import os
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb
from sklearn.preprocessing import RobustScaler, MinMaxScaler
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
from pyod.models.iforest import IForest
from pyod.models.hbos import HBOS
from pyod.models.lof import LOF

STORAGE_FEATS = [
    'total_accesses', 'mean_access_size', 'std_access_size', 'mean_entropy', 
    'high_entropy_ratio', 'io_acceleration', 'burstiness', 'unique_blocks', 
    'block_range', 'entropy_trend', 'entropy_variance_blocks', 'peak_entropy_ratio', 
    'access_rate', 'inter_access_mean', 'inter_access_std', 'sequential_ratio', 
    'write_size_uniformity', 'total_bytes', 'read_count', 'read_ratio'
]

MEMORY_FEATS = [
    'write_count', 'write_ratio', 'rw_ratio', 'write_entropy_mean', 
    'high_entropy_write_ratio', 'write_acceleration'
]

ALL_MODEL_FEATS = STORAGE_FEATS + MEMORY_FEATS
LOG_FEATS = ['total_accesses', 'total_bytes', 'read_count', 'write_count']

COUNCIL_WEIGHTS = {
    "IF_storage": 0.05, "IF_memory": 0.05, "IF_full": 0.05,
    "HBOS": 0.30, "LOF": 0.40, "IF_diverse": 0.10
}

def load_and_preprocess(filepath: str) -> pd.DataFrame:
    df = pd.read_parquet(filepath)
    for f in LOG_FEATS:
        if f in df.columns:
            df[f] = np.log1p(df[f].fillna(0).astype(float))
    if 'pid' not in df.columns:
        df['pid'] = df.index 
    return df

def fit_feature_scalers(df_benign: pd.DataFrame) -> dict:
    return {
        "storage": RobustScaler().fit(df_benign[STORAGE_FEATS].fillna(0).values),
        "memory": RobustScaler().fit(df_benign[MEMORY_FEATS].fillna(0).values),
        "full": RobustScaler().fit(df_benign[ALL_MODEL_FEATS].fillna(0).values)
    }

def train_unsupervised_council(df_benign: pd.DataFrame, scalers: dict) -> tuple:
    Xs = scalers["storage"].transform(df_benign[STORAGE_FEATS].fillna(0).values)
    Xm = scalers["memory"].transform(df_benign[MEMORY_FEATS].fillna(0).values)
    Xg = scalers["full"].transform(df_benign[ALL_MODEL_FEATS].fillna(0).values)

    models = {
        "IF_storage": IForest(n_estimators=100, contamination=0.01, random_state=42).fit(Xs),
        "IF_memory": IForest(n_estimators=100, contamination=0.01, random_state=42).fit(Xm),
        "IF_full": IForest(max_features=0.8, contamination=0.01, random_state=42).fit(Xg),
        "HBOS": HBOS(n_bins=50, contamination=0.01).fit(Xg),
        "LOF": LOF(n_neighbors=20, contamination=0.01).fit(Xg),
        "IF_diverse": IForest(max_samples=128, contamination=0.01, random_state=42).fit(Xg)
    }

    score_scalers = {}
    for name, model in models.items():
        score_scalers[name] = MinMaxScaler().fit(model.decision_scores_.reshape(-1, 1))

    return models, score_scalers

def calculate_council_score(df: pd.DataFrame, models: dict, feature_scalers: dict, score_scalers: dict) -> np.ndarray:
    Xs = feature_scalers["storage"].transform(df[STORAGE_FEATS].fillna(0).values)
    Xm = feature_scalers["memory"].transform(df[MEMORY_FEATS].fillna(0).values)
    Xg = feature_scalers["full"].transform(df[ALL_MODEL_FEATS].fillna(0).values)
    feature_mappings = {"IF_storage": Xs, "IF_memory": Xm, "IF_full": Xg, "HBOS": Xg, "LOF": Xg, "IF_diverse": Xg}
    final_scores = np.zeros(len(df))
    for name, model in models.items():
        raw_scores = model.decision_function(feature_mappings[name])
        norm_scores = score_scalers[name].transform(raw_scores.reshape(-1, 1)).flatten()
        final_scores += norm_scores * COUNCIL_WEIGHTS[name]
    return final_scores

dataset_path = r"C:\Users\gokul D\CapstoneML\CapstoneML\ransmap_features_v2.parquet"
df = load_and_preprocess(dataset_path)

df_benign_train = df[(df['split'] == 'original') & (df['label'] == 0)]
df_robust = df[df['split'].isin(['extra', 'variants'])]

feature_scalers = fit_feature_scalers(df_benign_train)
models, score_scalers = train_unsupervised_council(df_benign_train, feature_scalers)
council_scores_robust = calculate_council_score(df_robust, models, feature_scalers, score_scalers)

print("Council Score Distribution for df_robust:")
print(pd.Series(council_scores_robust).describe())
print("\nBy Label:")
print(df_robust.assign(cs=council_scores_robust).groupby('label')['cs'].describe())

mask_ransom = council_scores_robust >= 0.35
mask_benign = council_scores_robust <= 0.15
df_robust_pseudo = df_robust[mask_ransom | mask_benign].copy()
df_robust_pseudo['pseudo_label'] = np.where(council_scores_robust[mask_ransom | mask_benign] >= 0.35, 1, 0)

print("\nPseudo-label counts:")
print(df_robust_pseudo['pseudo_label'].value_counts())
print("\nPseudo-label vs True Label:")
print(pd.crosstab(df_robust_pseudo['pseudo_label'], df_robust_pseudo['label']))
