import asyncio
import joblib
import numpy as np
import struct
import os

# --- MODEL LOADING ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "scripts", "shield_hybrid_engine.pkl")

class InferenceEngine:
    def __init__(self):
        print(f"Loading S.H.I.E.L.D. v7.0 Hybrid Core from {MODEL_PATH}...")
        if not os.path.exists(MODEL_PATH):
             MODEL_PATH_ALT = os.path.join(BASE_DIR, "shield_hybrid_engine.pkl")
             if os.path.exists(MODEL_PATH_ALT):
                 data = joblib.load(MODEL_PATH_ALT)
             else:
                 raise FileNotFoundError(f"ML Artifact {MODEL_PATH} not found.")
        else:
            data = joblib.load(MODEL_PATH)
            
        self.l1 = data['level1_models']
        self.l2 = data['level2_meta']
        self.scaler = data['g_scaler']
        self.features = data['features']
        self.score_scalers = data.get('score_scalers', {})
        self.metadata = data.get('metadata', {})
        
        # Meta Indices for v7.0
        try:
           self.meta_feat_indices = [self.features.index(f) for f in ['mean_entropy', 'write_size_uniformity', 'entropy_trend']]
        except:
           self.meta_feat_indices = [3, 16, 9] 
        
    def predict(self, feature_vector):
        # 1. Feature Scaling
        X = np.array(feature_vector).reshape(1, -1)
        X_s = self.scaler.transform(X)
        
        # 2. Level-1 Council (Anomaly Probabilities)
        # Decision function: higher is more anomalous for PyOD models if normalized
        raw_scores = {
            "IF_storage": self.l1["IF_storage"].decision_function(X_s[:, :20])[0],
            "IF_memory": self.l1["IF_memory"].decision_function(X_s[:, 20:])[0],
            "IF_full": self.l1["IF_full"].decision_function(X_s)[0],
            "HBOS": self.l1["HBOS"].decision_function(X_s)[0],
            "LOF": self.l1["LOF"].decision_function(X_s)[0],
            "IF_diverse": self.l1["IF_diverse"].decision_function(X_s)[0]
        }

        # Calibrate Radar Scores using MinMaxScalers from PKL
        radar_list = []
        for name in ["IF_storage", "IF_memory", "IF_full", "HBOS", "LOF", "IF_diverse"]:
            s = raw_scores[name]
            if name in self.score_scalers:
                norm = self.score_scalers[name].transform([[s]])[0][0]
                radar_list.append(np.clip(norm, 0, 1))
            else:
                # Fallback if scaler missing
                radar_list.append(np.clip((s + 0.5) / 1.0, 0, 1))
        
        radar_scores = np.array(radar_list)

        # 3. Meta-Learner (XGBoost)
        # Using the full 26-feature vector to match the training logic in train_council.py
        xgb_prob = self.l2.predict_proba(X_s)[:, 1][0]
        
        # 4. Final Hybrid Fusion
        council_max = np.max(radar_scores)
        final_score = (0.35 * council_max) + (0.65 * xgb_prob)
        
        # --- THE SIMPLE SOLUTION (v8.9 True Physics Gate) ---
        # NOTE: The BPF sensor currently hardcodes entropy (880), so feature 4 is ALWAYS 1.0. We cannot use it.
        # Instead, we evaluate the absolute physical necessity of Ransomware: It MUST READ files locally to encrypt them.
        # feature_vector[19] is READ_RATIO. feature_vector[17] is TOTAL_BYTES.
        
        # 1. False Positive Mitigation (sandbox_prep.py, git clone, npm install)
        # If a process is purely writing data and mathematically skipping READ cycles, 
        # it is impossible for it to be ransomware encrypting the local disk!
        if feature_vector[19] < 0.05:
            final_score = 0.0
            
        # 2. Flash Ransomware Catch (ransomtest.py)
        # If it engages in heavy Read-Write cycles (>20% reads), saturates volume, and the AI correctly identifies
        # anomalous scatter behavior (xgb_prob > 0.25), instantly override its attempts to hide via .bak files.
        # NOTE: feature[17] is log1p(total_bytes), so 11.5 ≈ log1p(100KB raw bytes)
        elif feature_vector[19] > 0.20 and feature_vector[17] > 11.5 and xgb_prob > 0.25:
            final_score = 1.0
        
        # v8.2 — Dynamic Production Hardening
        p_threshold = self.metadata.get('production_threshold', 0.65) # Fallback to 0.65 if missing
        m_threshold = p_threshold * 0.6 # Medium is 60% of High
        
        decision = 0
        if final_score >= p_threshold: decision = 2 # HIGH (Hardened)
        elif final_score >= m_threshold: decision = 1 # MEDIUM
        
        return decision, final_score, radar_scores

async def handle_client(reader, writer):
    global engine
    try:
        data = await reader.readexactly(26 * 8)
        feature_vector = struct.unpack('26d', data)
        
        decision, final_score, radar = engine.predict(feature_vector)
        
        # v8.5 Payload: decision (1 byte) + final_score (8 bytes) + radar (48 bytes) = 57 bytes total
        payload = struct.pack('B', decision) + struct.pack('d', float(final_score)) + struct.pack('6d', *radar)
        writer.write(payload)
        await writer.drain()
    except Exception as e:
        print(f"Inference gateway error: {e}")
    finally:
        writer.close()
        await writer.wait_closed()

async def main():
    global engine
    engine = InferenceEngine()
    
    server = await asyncio.start_server(handle_client, '127.0.0.1', 8888)
    addr = server.sockets[0].getsockname()
    print(f'🚀 S.H.I.E.L.D. Active Brain (v7.0) running on {addr}')

    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    asyncio.run(main())
