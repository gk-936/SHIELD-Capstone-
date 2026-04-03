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
        # Meta features: 6 raw model probes + 3 raw scaled behavioral features
        meta_input = np.column_stack([
            np.array(list(raw_scores.values())).reshape(1, -1),
            X_s[:, self.meta_feat_indices]
        ])
        
        xgb_prob = self.l2.predict_proba(meta_input)[:, 1][0]
        
        # 4. Final Hybrid Fusion
        council_max = np.max(radar_scores)
        final_score = (0.35 * council_max) + (0.65 * xgb_prob)
        
        decision = 0
        if final_score >= 0.59: decision = 2 # HIGH
        elif final_score >= 0.35: decision = 1 # MEDIUM
        
        return decision, radar_scores

async def handle_client(reader, writer):
    global engine
    try:
        data = await reader.readexactly(26 * 8)
        feature_vector = struct.unpack('26d', data)
        
        decision, radar = engine.predict(feature_vector)
        
        payload = struct.pack('B', decision) + struct.pack('6d', *radar)
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
