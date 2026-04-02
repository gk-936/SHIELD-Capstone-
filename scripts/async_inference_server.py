import asyncio
import joblib
import numpy as np
import struct
import os

# --- MODEL LOADING ---
MODEL_PATH = r"C:\Users\gokul D\CapstoneML\CapstoneML\shield_hybrid_engine.pkl"

class InferenceEngine:
    def __init__(self):
        print(f"Loading Hybrid Core from {MODEL_PATH}...")
        data = joblib.load(MODEL_PATH)
        self.l1 = data['level1_models']
        self.l2 = data['level2_meta']
        self.scaler = data['g_scaler']
        self.features = data['features']
        
        # Meta Indices
        self.idx_mean_entropy = self.features.index('mean_entropy')
        self.idx_uniformity = self.features.index('write_size_uniformity')
        self.idx_trend = self.features.index('entropy_trend')
        
    def predict(self, feature_vector):
        # 1. Transform & Scale
        X_s = self.scaler.transform([feature_vector])
        
        # 2. Get Meta-Features (Level 1 Anomaly Probabilities)
        p_if_s = self.l1["IF_storage"].predict_proba(X_s[:, :20])[:, 1] # Fixed slice if s_scaler exists or just transform
        p_if_m = self.l1["IF_memory"].predict_proba(X_s[:, 20:])[:, 1] # Fixed
        # More probs from ECOD/COPOD/HBOS/LOF
        p_ecod = self.l1["ECOD"].predict_proba(X_s)[:, 1]
        p_copod = self.l1["COPOD"].predict_proba(X_s)[:, 1]
        p_hbos = self.l1["HBOS"].predict_proba(X_s)[:, 1]
        p_lof = self.l1["LOF"].predict_proba(X_s)[:, 1]
        
        # 3. Meta Vector
        meta = np.column_stack([
            p_if_s, p_if_m, p_ecod, p_copod, p_hbos, p_lof,
            X_s[:, self.idx_mean_entropy], 
            X_s[:, self.idx_uniformity], 
            X_s[:, self.idx_trend]
        ])
        
        # 4. Final Hybrid Verdict
        prob = self.l2.predict_proba(meta)[:, 1][0]
        
        if prob > 0.8: return 2 # HIGH (Ransomware)
        if prob > 0.4: return 1 # MEDIUM (Suspicious)
        return 0 # Benign

async def handle_client(reader, writer):
    global engine
    # Receive 26 * 8 bytes (doubles)
    try:
        data = await reader.readexactly(26 * 8)
        feature_vector = struct.unpack('26d', data)
        
        # Run Async Inference
        decision = engine.predict(feature_vector)
        
        # Send decision back (1 byte)
        writer.write(struct.pack('B', decision))
        await writer.drain()
    except Exception as e:
        print(f"Inference error: {e}")
    finally:
        writer.close()
        await writer.wait_closed()

async def main():
    global engine
    engine = InferenceEngine()
    
    server = await asyncio.start_server(handle_client, '127.0.0.1', 8888)
    addr = server.sockets[0].getsockname()
    print(f'🚀 S.H.I.E.L.D. Async Inference Server running on {addr}')

    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    asyncio.run(main())
