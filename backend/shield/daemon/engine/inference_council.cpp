#include "inference_council.h"
#include <cmath>
#include <algorithm>
#include <numeric>

namespace shield {

InferenceCouncil::InferenceCouncil() : last_score_(0.0f) {
    last_radar_scores_.resize(6, 0.0f);
}

int InferenceCouncil::Predict(const std::vector<float>& features) {
    if (features.size() < (GLOBAL_FEAT_COUNT)) return 0;

    // 1. Feature Scaling (3-Tier)
    std::vector<float> s_scaled(STORAGE_FEAT_COUNT);
    for (int i = 0; i < STORAGE_FEAT_COUNT; ++i) {
        s_scaled[i] = (features[i] - SCALER_S_CENTER[i]) / SCALER_S_SCALE[i];
    }

    std::vector<float> m_scaled(MEMORY_FEAT_COUNT);
    for (int i = 0; i < MEMORY_FEAT_COUNT; ++i) {
        m_scaled[i] = (features[STORAGE_FEAT_COUNT + i] - SCALER_M_CENTER[i]) / SCALER_M_SCALE[i];
    }

    std::vector<float> g_scaled(GLOBAL_FEAT_COUNT);
    for (int i = 0; i < GLOBAL_FEAT_COUNT; ++i) {
        g_scaled[i] = (features[i] - SCALER_G_CENTER[i]) / SCALER_G_SCALE[i];
    }

    // 2. Level-1 Council Inference
    float raw_scores[6];
    
    // We assume tree walking logic is implemented for IF and XGB
    // For IF, we use average path length. For XGB, we sum tree outputs.
    
    // IF_storage (Uses S-scaled features)
    raw_scores[0] = ScoreIForest(s_scaled, nullptr, 0); // Need actual tree refs if implemented
    // IF_memory (Uses M-scaled features)
    raw_scores[1] = ScoreIForest(m_scaled, nullptr, 0);
    // IF_full (Uses G-scaled features)
    raw_scores[2] = ScoreIForest(g_scaled, nullptr, 0);
    // HBOS (Uses G-scaled features)
    raw_scores[3] = ScoreHBOS(g_scaled);
    // LOF (Uses G-scaled features)
    raw_scores[4] = ScoreLOF(g_scaled);
    // IF_diverse (Uses G-scaled features)
    raw_scores[5] = ScoreIForest(g_scaled, nullptr, 0);

    // 3. Normalization & Weighting (Per v7.0 refactor)
    float council_score = 0.0f;
    for (int i = 0; i < 6; ++i) {
        float norm = (raw_scores[i] - MODEL_NORMALIZERS[i].min) / MODEL_NORMALIZERS[i].scale;
        norm = std::max(0.0f, std::min(1.0f, norm)); // Clamp [0, 1]
        last_radar_scores_[i] = norm;
        council_score += norm * ENSEMBLE_WEIGHTS[i];
    }

    // 4. Level-2 XGBoost Logic
    float xgb_prob = ScoreXGBoost(g_scaled);
    
    // Final Hybrid Fusion: 0.35 * council + 0.65 * xgb
    last_score_ = (0.35f * council_score) + (0.65f * xgb_prob);

    // 5. Thresholding (v7.0 Calibration)
    if (last_score_ >= THRESHOLD_RANSOMWARE) return 2; // HIGH (0.59)
    if (last_score_ >= THRESHOLD_SUSPICIOUS) return 1; // MEDIUM (0.35)
    
    return 0; // Benign
}

float InferenceCouncil::ScoreIForest(const std::vector<float>& features, const struct IFNode* tree_base, int tree_count) {
    // Basic scoring: average path length (simplified for MVP as requested)
    // In a full implementation, we'd traverse tree_count trees starting at tree_base.
    return 0.5f; 
}

float InferenceCouncil::ScoreHBOS(const std::vector<float>& features) {
    return 0.45f; // HBOS decision score placeholder
}

float InferenceCouncil::ScoreLOF(const std::vector<float>& features) {
    return 1.1f; // LOF decision score placeholder (usually > 1 for anomalies)
}

float InferenceCouncil::ScoreXGBoost(const std::vector<float>& g_features) {
    // XGBoost ensemble summation placeholder
    return 0.2f; 
}

} // namespace shield
