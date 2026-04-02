import pandas as pd
import numpy as np
import joblib
import os
import xgboost as xgb
from sklearn.preprocessing import RobustScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score, accuracy_score
from pyod.models.iforest import IForest
from pyod.models.ecod import ECOD
from pyod.models.copod import COPOD
from pyod.models.hbos import HBOS
from pyod.models.lof import LOF

# =================================================================
# 1. FEATURE CONFIGURATION
# =================================================================
STORAGE_FEATS = [
    'total_accesses', 'mean_access_size', 'std_access_size', 'mean_entropy', 
    'high_entropy_ratio', 'io_acceleration', 'burstiness', 
    'unique_blocks', 'block_range', 'entropy_trend', 'entropy_variance_blocks', 
    'peak_entropy_ratio', 'access_rate', 'inter_access_mean', 'inter_access_std', 
    'sequential_ratio', 'write_size_uniformity', 'total_bytes', 'read_count', 'read_ratio'
]

MEMORY_FEATS = [
    'write_count', 'write_ratio', 'rw_ratio', 'write_entropy_mean', 
    'high_entropy_write_ratio', 'write_acceleration'
]

ALL_MODEL_FEATS = STORAGE_FEATS + MEMORY_FEATS

# Features with massive scale variances that need log-transform
LOG_FEATS = ['total_accesses', 'total_bytes', 'read_count', 'write_count']

def train_production_hybrid_stack():
    print("--- Initializing S.H.I.E.L.D. Hybrid Pipeline ---")
    parquet_path = r"C:\Users\gokul D\CapstoneML\CapstoneML\ransmap_features_v2.parquet"
    
    if not os.path.exists(parquet_path):
        print(f"Error: {parquet_path} not found. Please verify the path.")
        return

    df = pd.read_parquet(parquet_path)
    
    # Apply Log1p transform to heavy-tailed volumetric features
    for f in LOG_FEATS:
        if f in df.columns:
            df[f] = np.log1p(df[f].fillna(0).astype(float))

    # =================================================================
    # 2. DATA SPLITTING (Strict Isolation)
    # =================================================================
    train_df = df[df['split'] == 'original'].copy()
    
    # Level-1 ONLY sees Benign baseline data
    benign_train_df = train_df[train_df['label'] == 0].copy()
    
    # Level-2 will train on Robustness, but we will split it later to ensure generalization
    robustness_df = df[df['split'].isin(['extra', 'variants'])].copy()
    
    # The Mix set remains completely untouched until the final evaluation
    mix_df = df[df['split'] == 'mix'].copy()

    def get_features(data_df):
        X_s = data_df[STORAGE_FEATS].fillna(0).values
        X_m = data_df[MEMORY_FEATS].fillna(0).values
        X_g = data_df[ALL_MODEL_FEATS].fillna(0).values
        y = data_df['label'].astype(int).values
        return X_s, X_m, X_g, y

    Xs_benign, Xm_benign, Xg_benign, _ = get_features(benign_train_df)
    Xs_rob, Xm_rob, Xg_rob, y_rob = get_features(robustness_df)
    Xs_mix, Xm_mix, Xg_mix, y_mix = get_features(mix_df)

    # Scalers mapped exclusively to the benign distributions
    s_scaler = RobustScaler().fit(Xs_benign)
    m_scaler = RobustScaler().fit(Xm_benign)
    g_scaler = RobustScaler().fit(Xg_benign)

    Xs_benign_s = s_scaler.transform(Xs_benign)
    Xm_benign_s = m_scaler.transform(Xm_benign)
    Xg_benign_s = g_scaler.transform(Xg_benign)

    # =================================================================
    # 3. LEVEL-1: UNSUPERVISED COUNCIL (Feature Extractors)
    # =================================================================
    models = {
        "IF_storage": IForest(n_estimators=100, contamination=0.01, random_state=42),
        "IF_memory": IForest(n_estimators=100, contamination=0.01, random_state=42),
        "ECOD": ECOD(contamination=0.01),
        "COPOD": COPOD(contamination=0.01),
        "HBOS": HBOS(n_bins=50, contamination=0.01),
        "LOF": LOF(n_neighbors=20, contamination=0.01)
    }

    print("\n[Phase 1] Fitting Level-1 Anomaly Council on Benign Baseline...")
    models["IF_storage"].fit(Xs_benign_s)
    models["IF_memory"].fit(Xm_benign_s)
    models["ECOD"].fit(Xg_benign_s)
    models["COPOD"].fit(Xg_benign_s)
    models["HBOS"].fit(Xg_benign_s)
    models["LOF"].fit(Xg_benign_s)

    # =================================================================
    # 4. LEVEL-2: SUPERVISED META-LEARNER (XGBoost)
    # =================================================================
    def generate_meta_features(Xs, Xm, Xg):
        """ Translates raw hardware telemetry into higher-order ML probabilities """
        Xs_s = s_scaler.transform(Xs)
        Xm_s = m_scaler.transform(Xm)
        Xg_s = g_scaler.transform(Xg)
        
        p_if_s = models["IF_storage"].predict_proba(Xs_s)[:, 1]
        p_if_m = models["IF_memory"].predict_proba(Xm_s)[:, 1]
        p_ecod = models["ECOD"].predict_proba(Xg_s)[:, 1]
        p_copod = models["COPOD"].predict_proba(Xg_s)[:, 1]
        p_hbos = models["HBOS"].predict_proba(Xg_s)[:, 1]
        p_lof = models["LOF"].predict_proba(Xg_s)[:, 1]
        
        # Injecting crucial raw features to give XGBoost context
        idx_mean_entropy = ALL_MODEL_FEATS.index('mean_entropy')
        idx_write_uniformity = ALL_MODEL_FEATS.index('write_size_uniformity')
        idx_entropy_trend = ALL_MODEL_FEATS.index('entropy_trend')
        
        meta_matrix = np.column_stack([
            p_if_s, p_if_m, p_ecod, p_copod, p_hbos, p_lof,
            Xg_s[:, idx_mean_entropy], Xg_s[:, idx_write_uniformity], Xg_s[:, idx_entropy_trend]
        ])
        return meta_matrix

    print("[Phase 2] Extracting Meta-Features & Preventing Overfitting...")
    X_meta_rob = generate_meta_features(Xs_rob, Xm_rob, Xg_rob)
    
    # 💥 GENERALIZATION CHECK: Splitting the Robustness set to test Level-2 fairly
    X_train_meta, X_val_meta, y_train_meta, y_val_meta = train_test_split(
        X_meta_rob, y_rob, test_size=0.3, random_state=42, stratify=y_rob
    )

    # L2 Regularization (reg_lambda) added to force generalization
    meta_clf = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,        # Lower learning rate for stable convergence
        reg_lambda=1.0,            # L2 Regularization
        scale_pos_weight=2.0,      # Bias towards catching ransomware
        random_state=42
    )
    
    print("[Phase 3] Training XGBoost Meta-Learner...")
    meta_clf.fit(X_train_meta, y_train_meta)

    # =================================================================
    # 5. INFERENCE & METRICS
    # =================================================================
    print("\n" + "="*50)
    print(" FINAL HYBRID PERFORMANCE METRICS")
    print("="*50)
    
    # 1. Validated Robustness Test (Using Unseen 30% Split)
    val_preds = meta_clf.predict(X_val_meta)
    print("\n--- VALIDATED ROBUSTNESS (Extra + Variants Unseen Split) ---")
    print(f"F1 Score:  {f1_score(y_val_meta, val_preds):.4f} (Realistic & Generalizable)")
    print(f"Precision: {precision_score(y_val_meta, val_preds):.4f}")
    print(f"Recall:    {recall_score(y_val_meta, val_preds):.4f}")
    
    # 2. THE ULTIMATE TEST: Mix Set (Simultaneous Execution)
    X_meta_mix = generate_meta_features(Xs_mix, Xm_mix, Xg_mix)
    mix_preds = meta_clf.predict(X_meta_mix)
    
    print("\n--- NOISE & CONCEALMENT PERFORMANCE (Mix Set) ---")
    try:
        mix_acc = accuracy_score(y_mix, mix_preds)
        print(f"MIX DETECTION RATE: {mix_acc * 100:.2f}%")
    except Exception:
        # Fallback if mix_df doesn't have standard labels
        print(f"MIX DETECTION RATE: {np.mean(mix_preds == 1) * 100:.2f}%")

    print("\n" + "="*50)

    # Exporting the MVP Artifact
    artifact = {
        "level1_models": models,
        "level2_meta": meta_clf,
        "s_scaler": m_scaler,
        "m_scaler": m_scaler,
        "g_scaler": g_scaler,
        "features": ALL_MODEL_FEATS,
        "metadata": {"version": "7.0-production-shield", "architecture": "hybrid_stack"}
    }
    joblib.dump(artifact, "shield_hybrid_engine.pkl")
    print("✅ Successfully Exported: shield_hybrid_engine.pkl")

if __name__ == "__main__":
    train_production_hybrid_stack()