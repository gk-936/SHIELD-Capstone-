import joblib
import os
import glob

def run_diagnostic():
    print("====================================================")
    print("   SHIELD INFRASTRUCTURE DIAGNOSTIC (Python Logic)  ")
    print("====================================================\n")

    # 1. Model Check
    model_path = 'final_hybrid_v2.pkl'
    print(f"[MODEL] Checking: {model_path}")
    if os.path.exists(model_path):
        try:
            data = joblib.load(model_path)
            s_feats = data.get('storage_features', [])
            m_feats = data.get('memory_features', [])
            total = len(s_feats) + len(m_feats)
            print(f"  -> Detected Feature Count: {total} ({len(s_feats)} Storage, {len(m_feats)} Memory)")
            if total == 27:
                print("  -> Status: MATCH (Production 27-Feature Model)")
            else:
                print(f"  -> Status: MISMATCH (Legacy {total}-Feature Model)")
                print(f"  -> Logic: System logic requires 27 features. Please update this .pkl file.")
        except Exception as e:
            print(f"  -> Error reading model: {e}")
    else:
        print(f"  -> Error: {model_path} NOT FOUND.")

    # 2. Dataset / Parquet Check
    print(f"\n[DATA] Checking for Parquet datasets...")
    parquet_files = glob.glob("*.parquet")
    if not parquet_files:
        print("  -> No versioned parquet datasets found in root.")
    else:
        for pf in sorted(parquet_files):
            size_kb = os.path.getsize(pf) / 1024
            print(f"  -> {pf} ({size_kb:.1f} KB)")
            # Explanation of versions based on typical progression:
            if "v1" in pf.lower():
                print("     (Likely the initial 16-feature ground truth)")
            elif "v2" in pf.lower():
                print("     (Attempt 2: Increased entropy/temporal resolution)")
            elif "v3" in pf.lower() or "final" in pf.lower():
                print("     (Production set: Complete 27 features for Council of Models)")

    print("\n[ADVICE] What do ransomware_features_v2 and v3 do?")
    print("----------------------------------------------------")
    print("1. V2 (Intermediate): Introduced high-entropy ratio and io_acceleration.")
    print("2. V3 (Production): Added sequential_ratio, write_size_uniformity, and ")
    print("   entropy_access_rate_ratio. These are CRITICAL for the current C++ logic.")
    print("----------------------------------------------------\n")

if __name__ == "__main__":
    run_diagnostic()
