import pandas as pd
import numpy as np
import joblib
import os
import xgboost as xgb
from sklearn.preprocessing import RobustScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, precision_score, recall_score, accuracy_score
from pyod.models.iforest import IForest

# --- Final Config for C++ Sync ---
STORAGE_FEATS = [
    'total_accesses', 'mean_access_size', 'std_access_size', 'mean_entropy', 
    'high_entropy_ratio', 'io_acceleration', 'burstiness', 'unique_blocks', 'block_range', 
    'entropy_trend', 'entropy_variance_blocks', 'peak_entropy_ratio', 'access_rate', 
    'inter_access_mean', 'inter_access_std', 'sequential_ratio', 'write_size_uniformity', 
    'total_bytes', 'read_count', 'read_ratio'
]
MEMORY_FEATS = [
    'write_count', 'write_ratio', 'rw_ratio', 'write_entropy_mean', 
    'high_entropy_write_ratio', 'write_acceleration'
]
ALL_MODEL_FEATS = STORAGE_FEATS + MEMORY_FEATS
LOG_FEATS = ['total_accesses', 'total_bytes', 'read_count', 'write_count']

def train_production_shield_7_1():
    print("--- Initializing S.H.I.E.L.D. v7.1 Production (C++ Optimized) ---")
    parquet_path = r"C:\Users\gokul D\CapstoneML\CapstoneML\ransmap_features_v2.parquet"
    df = pd.read_parquet(parquet_path)
    
    # 1. Log Transform
    for f in LOG_FEATS:
        df[f] = np.log1p(df[f].fillna(0).astype(float))

    # 2. Split
    train_df = df[df['split'] == 'original'].copy()
    benign_train_df = train_df[train_df['label'] == 0].copy()
    robustness_df = df[df['split'].isin(['extra', 'variants'])].copy()
    mix_df = df[df['split'] == 'mix'].copy()

    X_train = benign_train_df[ALL_MODEL_FEATS].values
    X_rob = robustness_df[ALL_MODEL_FEATS].values
    y_rob = robustness_df['label'].values
    X_mix = mix_df[ALL_MODEL_FEATS].values
    y_mix = mix_df['label'].values

    # 3. Scaler
    scaler = RobustScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_rob_s = scaler.transform(X_rob)
    X_mix_s = scaler.transform(X_mix)

    # 4. Level-1: All IF Specialists (Compatible with C++ Engine)
    # n_estimators=50 to minimize C++ header size (still highly accurate)
    l1_models = {
        "IF_s": IForest(n_estimators=50, contamination=0.01, random_state=42),
        "IF_m": IForest(n_estimators=50, contamination=0.01, random_state=42),
        "IF_f": IForest(n_estimators=50, contamination=0.01, random_state=42),
        "IF_d": IForest(n_estimators=50, contamination=0.05, bootstrap=True, random_state=7)
    }

    # Slice indices
    s_idx = [ALL_MODEL_FEATS.index(f) for f in STORAGE_FEATS]
    m_idx = [ALL_MODEL_FEATS.index(f) for f in MEMORY_FEATS]

    l1_models["IF_s"].fit(X_train_s[:, s_idx])
    l1_models["IF_m"].fit(X_train_s[:, m_idx])
    l1_models["IF_f"].fit(X_train_s)
    l1_models["IF_d"].fit(X_train_s)

    # 5. Level-2 Meta Meta-Features
    def get_meta(X_s):
        meta = np.column_stack([
            l1_models["IF_s"].decision_function(X_s[:, s_idx]), # Raw anomaly score (neg is more anomalous)
            l1_models["IF_m"].decision_function(X_s[:, m_idx]),
            l1_models["IF_f"].decision_function(X_s),
            l1_models["IF_d"].decision_function(X_s),
            # Plus 3 crucial raw features for XGB context
            X_s[:, ALL_MODEL_FEATS.index('mean_entropy')],
            X_s[:, ALL_MODEL_FEATS.index('write_size_uniformity')],
            X_s[:, ALL_MODEL_FEATS.index('entropy_trend')]
        ])
        return meta

    X_meta_rob = get_meta(X_rob_s)
    
    # Train L2 XGBoost
    meta_clf = xgb.XGBClassifier(n_estimators=100, max_depth=3, learning_rate=0.05, random_state=42)
    meta_clf.fit(X_meta_rob, y_rob)

    # Eval on Mix
    X_meta_mix = get_meta(X_mix_s)
    preds = meta_clf.predict(X_meta_mix)
    acc = accuracy_score(y_mix, preds)
    print(f"\n--- PERFORMANCE ---")
    print(f"F1 Score: {f1_score(y_mix, preds):.4f}")
    print(f"Recall:   {recall_score(y_mix, preds):.4f}")
    print(f"Accuracy: {acc * 100:.2f}%")

    # Export
    artifact = {
        "l1_models": l1_models, "l2": meta_clf, "scaler": scaler, "features": ALL_MODEL_FEATS,
        "s_idx": s_idx, "m_idx": m_idx, "meta_features": "if_s, if_m, if_f, if_d, entropy, uniformity, trend"
    }
    joblib.dump(artifact, "shield_v7_1_lite.pkl")
    meta_clf.get_booster().dump_model('xgb_lite.json', dump_format='json')
    print("✅ Exported: shield_v7_1_lite.pkl and xgb_lite.json")

if __name__ == "__main__":
    train_production_shield_7_1()
