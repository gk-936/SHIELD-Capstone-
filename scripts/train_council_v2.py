import os
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import RobustScaler, MinMaxScaler
from sklearn.ensemble import IsolationForest
from pyod.models.hbos import HBOS
from pyod.models.lof import LOF
from sklearn.metrics import f1_score, recall_score, roc_auc_score

# --- Path Configuration ---
DATA_PATH = r"C:\Users\gokul D\CapstoneML\CapstoneML\ransmap_features_v2.parquet"
OUTPUT_PATH = r"C:\Users\gokul D\CapstoneML\CapstoneML\scripts\council_v4_ransmap.pkl"

def main():
    if not os.path.exists(DATA_PATH):
        print(f"Error: Dataset not found at {DATA_PATH}")
        return

    # --- UNIFIED 26-FEATURE LIST (EXACT C++ ORDER) ---
    # Index matches FeatureVector::Index in feature_types.h (STD_ENTROPY removed)
    FEATURES = [
        "total_accesses", "mean_access_size", "std_access_size", "mean_entropy", 
        "high_entropy_ratio", "entropy_spike_count", "entropy_trend", "entropy_variance_blocks", 
        "peak_entropy_ratio", "duration_sec", "access_rate", "inter_access_mean", 
        "inter_access_std", "burstiness", "io_acceleration", "unique_blocks", 
        "block_range", "sequential_ratio", "write_size_uniformity", "entropy_access_rate_ratio", 
        "write_count", "write_ratio", "rw_ratio", "write_entropy_mean", 
        "high_entropy_write_ratio", "write_acceleration"
    ]

    # Model Splitting Indices
    # Storage Specialists (Typically first 18-20)
    STORAGE_FEATS = FEATURES[:20]
    # Memory Specialists (Entropy & Ratios)
    MEMORY_FEATS = FEATURES[20:] # and maybe entropy ones too

    print(f"--- Loading Ransmap V2 Dataset ---")
    df = pd.read_parquet(DATA_PATH)
    df = df.replace([np.inf, -np.inf], 0).fillna(0)

    # SUCCESS STRATEGY: Train on Benign-only 'original' split
    train_df = df[(df['split'] == 'original') & (df['label'] == 0)]
    val_df = df[df['split'].isin(['extra', 'variants'])]
    test_df = df[df['split'] == 'mix']

    print(f"Training on 26 features: {len(train_df)} samples (Benign)")
    
    X_train = train_df[FEATURES].values
    y_val = val_df['label'].values
    X_val = val_df[FEATURES].values
    X_test = test_df[FEATURES].values

    # Preprocessing (Global Scaler for C++ ease)
    scaler = RobustScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_val_s = scaler.transform(X_val)
    X_test_s = scaler.transform(X_test)

    # Indices for split models
    s_idx = [FEATURES.index(f) for f in STORAGE_FEATS]
    m_idx = [FEATURES.index(f) for f in MEMORY_FEATS]

    # --- Fitting Council Models ---
    print(f"\nFitting Council Models...")
    contam = 0.05
    if_storage = IsolationForest(n_estimators=200, contamination=contam, random_state=42).fit(X_train_s[:, s_idx])
    if_memory  = IsolationForest(n_estimators=200, contamination=contam, random_state=42).fit(X_train_s[:, m_idx])
    if_full    = IsolationForest(n_estimators=200, contamination=contam, random_state=42).fit(X_train_s)
    if_diverse = IsolationForest(n_estimators=200, contamination=0.10, bootstrap=True, random_state=7).fit(X_train_s)
    hbos_mdl   = HBOS(contamination=contam).fit(X_train_s)
    lof_mdl    = LOF(contamination=contam, n_jobs=-1).fit(X_train_s)

    # Fusion Logic
    def get_fused(X_scaled):
        # Raw Anomaly Scores (Higher = Outlier)
        # Note: Sklearn IF returns negative of anomaly scores (lower is more outlier)
        # We invert it to match outliers > high
        raw = {
            "IF_s": -if_storage.decision_function(X_scaled[:, s_idx]),
            "IF_m": -if_memory.decision_function(X_scaled[:, m_idx]),
            "IF_f": -if_full.decision_function(X_scaled),
            "hbos": hbos_mdl.decision_function(X_scaled),
            "lof":  lof_mdl.decision_function(X_scaled),
            "IF_d": -if_diverse.decision_function(X_scaled),
        }
        
        # In a real fusion we would MinMax normalize here, 
        # but the C++ engine needs a stable sum.
        # We'll use the optimized weights from the notebook.
        weights = [0.15, 0.20, 0.20, 0.15, 0.10, 0.20]
        model_keys = ["IF_s", "IF_m", "IF_f", "hbos", "lof", "IF_d"]
        
        fused = np.zeros(len(X_scaled))
        for i, k in enumerate(model_keys):
            fused += weights[i] * raw[k]
        return fused

    scores_val = get_fused(X_val_s)
    # Calibrate Threshold
    threshold = np.percentile(scores_val[y_val == 0], 95)
    y_val_pred = (scores_val > threshold).astype(int)

    print(f"\n--- PERFORMANCE (26 Features) ---")
    print(f"F1 Score:  {f1_score(y_val, y_val_pred):.4f}")
    print(f"Recall:    {recall_score(y_val, y_val_pred):.4f}")
    print(f"ROC AUC:   {roc_auc_score(y_val, scores_val):.4f}")

    # Save to PKL
    model_data = {
        "if_storage": if_storage, "if_memory": if_memory, "if_full": if_full,
        "if_diverse": if_diverse, "hbos": hbos_mdl, "lof": lof_mdl,
        "scaler": scaler, "threshold": threshold, "features": FEATURES,
        "s_idx": s_idx, "m_idx": m_idx
    }
    joblib.dump(model_data, OUTPUT_PATH)
    print(f"\n✅ Created: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
