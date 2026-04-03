import os
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb
from sklearn.preprocessing import RobustScaler, MinMaxScaler
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix, roc_curve
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
    """Loads parquet data and applies log normalization to heavy-tailed features."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Dataset not found at {filepath}")
    
    df = pd.read_parquet(filepath)
    for f in LOG_FEATS:
        if f in df.columns:
            df[f] = np.log1p(df[f].fillna(0).astype(float))
            
    if 'pid' not in df.columns:
        df['pid'] = df.index 
        
    return df

def fit_feature_scalers(df_benign: pd.DataFrame) -> dict:
    """Fits RobustScalers exclusively on benign training data."""
    return {
        "storage": RobustScaler().fit(df_benign[STORAGE_FEATS].fillna(0).values),
        "memory": RobustScaler().fit(df_benign[MEMORY_FEATS].fillna(0).values),
        "full": RobustScaler().fit(df_benign[ALL_MODEL_FEATS].fillna(0).values)
    }

def train_unsupervised_council(df_benign: pd.DataFrame, scalers: dict) -> tuple:
    """Trains the 6 Level-1 PyOD models and their score normalizers."""
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
    """Calculates the weighted ensemble score from the unsupervised council."""
    Xs = feature_scalers["storage"].transform(df[STORAGE_FEATS].fillna(0).values)
    Xm = feature_scalers["memory"].transform(df[MEMORY_FEATS].fillna(0).values)
    Xg = feature_scalers["full"].transform(df[ALL_MODEL_FEATS].fillna(0).values)

    feature_mappings = {
        "IF_storage": Xs, "IF_memory": Xm, "IF_full": Xg,
        "HBOS": Xg, "LOF": Xg, "IF_diverse": Xg
    }

    n_samples = len(df)
    final_scores = np.zeros(n_samples)

    for name, model in models.items():
        raw_scores = model.decision_function(feature_mappings[name])
        norm_scores = score_scalers[name].transform(raw_scores.reshape(-1, 1)).flatten()
        final_scores += norm_scores * COUNCIL_WEIGHTS[name]

    return final_scores

def generate_pseudo_labels(df: pd.DataFrame, council_scores: np.ndarray) -> pd.DataFrame:
    """Applies semi-supervised labeling rules to filter the training set."""
    df_pseudo = df.copy()
    df_pseudo['council_score'] = council_scores
    
    mask_ransom = df_pseudo['council_score'] >= 0.35
    mask_benign = df_pseudo['council_score'] <= 0.15
    
    df_filtered = df_pseudo[mask_ransom | mask_benign].copy()
    df_filtered['pseudo_label'] = np.where(df_filtered['council_score'] >= 0.35, 1, 0)
    
    return df_filtered

def train_xgboost_metalearner(df_train: pd.DataFrame, feature_scalers: dict) -> xgb.XGBClassifier:
    """Trains the Level-2 classifier using pseudo-labels."""
    X_train = feature_scalers["full"].transform(df_train[ALL_MODEL_FEATS].fillna(0).values)
    y_train = df_train['pseudo_label'].values

    n_benign = np.sum(y_train == 0)
    n_ransom = np.sum(y_train == 1)
    
    scale_weight = max(1.0, n_benign / n_ransom) if n_ransom > 0 else 1.0

    clf = xgb.XGBClassifier(
        n_estimators=600,
        max_depth=5,     
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        scale_pos_weight=scale_weight,
        eval_metric='auc', # Changed to optimize for AUC
        random_state=42
    )
    clf.fit(X_train, y_train)
    return clf

def find_fpr_threshold(y_true: np.ndarray, scores: np.ndarray, target_fpr: float = 0.01) -> float:
    """Finds the threshold that achieves a target False Positive Rate."""
    fpr, tpr, thresholds = roc_curve(y_true, scores)
    idx = np.where(fpr <= target_fpr)[0][-1]
    return thresholds[idx]

def evaluate_hybrid_pipeline(df_eval: pd.DataFrame, models: dict, feature_scalers: dict, score_scalers: dict, meta_clf: xgb.XGBClassifier, dataset_name: str) -> float:
    """Calculates final hybrid scores, outputs metrics, and returns the 1% FPR threshold."""
    council_scores = calculate_council_score(df_eval, models, feature_scalers, score_scalers)
    Xg = feature_scalers["full"].transform(df_eval[ALL_MODEL_FEATS].fillna(0).values)
    xgb_probs = meta_clf.predict_proba(Xg)[:, 1]
    
    hybrid_scores = (0.35 * council_scores) + (0.65 * xgb_probs)
    y_true = df_eval['label'].astype(int).values
    
    # ─── Balanced Threshold (0.48) ───
    b_threshold = 0.48
    y_pred_b = (hybrid_scores >= b_threshold).astype(int)
    
    # ─── Hardened Production Threshold (1% FPR) ───
    p_threshold = b_threshold
    if len(np.unique(y_true)) > 1:
        p_threshold = find_fpr_threshold(y_true, hybrid_scores, target_fpr=0.01)
    
    y_pred_p = (hybrid_scores >= p_threshold).astype(int)
    
    print(f"\n{'='*60}\nEVALUATION REPORT: {dataset_name.upper()}\n{'='*60}")
    
    if len(np.unique(y_true)) > 1:
        print(f"ROC AUC Score: {roc_auc_score(y_true, hybrid_scores):.4f}")
    else:
        print(f"ROC AUC Score: nan (Only one class present in y_true)")
        
    print(f"\n[🔬] MODE A: BALANCED ALERT (Threshold = {b_threshold:.2f})")
    print(classification_report(y_true, y_pred_b, target_names=['Benign', 'Ransomware'], digits=4, zero_division=0))
    cm_b = confusion_matrix(y_true, y_pred_b, labels=[0, 1])
    print(f"Confusion Matrix (Balanced): TN: {cm_b[0][0]}, FP: {cm_b[0][1]}, FN: {cm_b[1][0]}, TP: {cm_b[1][1]}")

    print(f"\n[🛡️] MODE B: PRODUCTION HARDENED (Threshold = {p_threshold:.4f} @ 1% FPR target)")
    print(classification_report(y_true, y_pred_p, target_names=['Benign', 'Ransomware'], digits=4, zero_division=0))
    cm_p = confusion_matrix(y_true, y_pred_p, labels=[0, 1])
    print(f"Confusion Matrix (Hardened): TN: {cm_p[0][0]}, FP: {cm_p[0][1]}, FN: {cm_p[1][0]}, TP: {cm_p[1][1]}")
    
    return p_threshold

def build_hybrid_engine():
    # Use relative path to dataset
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(BASE_DIR, "ransmap_features_v2.parquet")
    df = load_and_preprocess(dataset_path)

    df_benign_train = df[(df['split'] == 'original') & (df['label'] == 0)]
    df_robust = df[df['split'].isin(['extra', 'variants'])]
    df_mix = df[df['split'] == 'mix']

    feature_scalers = fit_feature_scalers(df_benign_train)
    
    models, score_scalers = train_unsupervised_council(df_benign_train, feature_scalers)

    council_scores_robust = calculate_council_score(df_robust, models, feature_scalers, score_scalers)
    df_robust_pseudo = generate_pseudo_labels(df_robust, council_scores_robust)

    gss = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=42)
    train_idx, val_idx = next(gss.split(df_robust_pseudo, groups=df_robust_pseudo['pid']))
    df_meta_train = df_robust_pseudo.iloc[train_idx]
    
    meta_clf = train_xgboost_metalearner(df_meta_train, feature_scalers)

    p_threshold = evaluate_hybrid_pipeline(df_robust, models, feature_scalers, score_scalers, meta_clf, "Robustness Validation (Out-of-Distribution & Variants)")
    evaluate_hybrid_pipeline(df_mix, models, feature_scalers, score_scalers, meta_clf, "Mix Split (Simultaneous Execution)")

    artifact = {
        "level1_models": models,
        "level1_score_scalers": score_scalers,
        "level2_meta": meta_clf,
        "s_scaler": feature_scalers["storage"], 
        "m_scaler": feature_scalers["memory"],
        "g_scaler": feature_scalers["full"],
        "features": ALL_MODEL_FEATS,
        "metadata": {
            "version": "7.2-hardened-shield", 
            "architecture": "hybrid_stack",
            "weights": COUNCIL_WEIGHTS,
            "production_threshold": p_threshold
        }
    }
    
    export_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shield_hybrid_engine.pkl")
    joblib.dump(artifact, export_path)
    print(f"\n[+] Exported deployment artifact: {export_path}")

if __name__ == "__main__":
    build_hybrid_engine()