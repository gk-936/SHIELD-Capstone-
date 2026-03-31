#include "inference_council.h"
#include <cmath>
#include <algorithm>

namespace shield {

InferenceCouncil::InferenceCouncil() : last_score_(0.0f) {}

int InferenceCouncil::Predict(const std::vector<float>& features) {
    if (features.size() != (STORAGE_FEAT_COUNT + MEMORY_FEAT_COUNT)) return 0;
    
    // 1. Scoring (Simplified for MVP, using the most stable model)
    float score_if_s = ScoreIsolationForest(features);
    float score_hbos = ScoreHBOS(features); // Placeholder
    
    // 2. Fusion (Weighted sum based on ensemble parameters)
    last_score_ = (ENSEMBLE_WEIGHTS[0] * score_if_s) + 
                  (ENSEMBLE_WEIGHTS[4] * score_hbos); 
    
    // 3. Normalization (using the exported MODEL_NORMALIZERS if mapping is correct)
    last_score_ = (last_score_ * MODEL_NORMALIZERS[0].scale) + MODEL_NORMALIZERS[0].min;

    // 4. Thresholding
    if (last_score_ >= THRESHOLD_RANSOMWARE) return 2; // High
    if (last_score_ >= THRESHOLD_SUSPICIOUS) return 1; // Medium
    
    return 0; // Benign
}

float InferenceCouncil::ScoreIsolationForest(const std::vector<float>& features) {
    // Basic scoring: average path length (simplified)
    // Here we'd traverse the exported trees in model_weights.h
    return 0.5f; // Placeholder: Real walker implementation goes here
}

float InferenceCouncil::ScoreHBOS(const std::vector<float>& features) {
    return 0.45f; // Placeholder
}

} // namespace shield
