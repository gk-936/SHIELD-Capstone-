#include "inference_council.h"
#include <cmath>
#include <algorithm>
#include "model_weights.h"

namespace shield {

InferenceCouncil::InferenceCouncil() : last_score_(0.0f) {}

static float ScoreTree(const IFNode* nodes, const std::vector<float>& features) {
    int16_t curr = 0;
    int16_t depth = 0;
    
    // Feature index -2 indicates a leaf in our serialized structure
    while (nodes[curr].feature != -2) {
        if (features[nodes[curr].feature] < nodes[curr].threshold) {
            curr = nodes[curr].left;
        } else {
            curr = nodes[curr].right;
        }
        depth++;
        if (depth > 256) break; // Safety break
    }
    return static_cast<float>(depth);
}

float InferenceCouncil::ScoreIsolationForest(const IFNode* const* trees, int tree_count, const std::vector<float>& features) {
    if (tree_count <= 0) return 0.5f;
    
    float total_depth = 0.0f;
    for (int i = 0; i < tree_count; ++i) {
        total_depth += ScoreTree(trees[i], features);
    }
    
    float avg_depth = total_depth / tree_count;
    // Isolation Forest anomaly score is roughly 2^(-avg_depth / c(n))
    // We can simplify this for internal ranking since we normalize later.
    // Higher depth = more benign. Lower depth = more anomalous.
    // We'll return a score where 1.0 is anomalous, 0.0 is benign.
    return 1.0f / (1.0f + std::exp(avg_depth * 0.1f)); 
}

int InferenceCouncil::Predict(const std::vector<float>& features) {
    if (features.size() < (STORAGE_FEAT_COUNT + MEMORY_FEAT_COUNT)) return 0;
    
    // 1. Storage Specialist Score (F0..F9)
    float score_if_s = ScoreIsolationForest(IF_S_TREES, IF_S_TREE_COUNT, features);
    
    // 2. Memory Specialist Score (F10..F15)
    std::vector<float> mem_features(features.begin() + STORAGE_FEAT_COUNT, features.end());
    // Since we only exported IF_S trees currently, we reuse logic or placeholder for M
    float score_if_m = 0.5f; 

    // 3. Fusion Logic (Sum of weighted normalized scores)
    // weights index: 0=IF_S, 1=IF_M, 2=IF_Full, 3=HBOS, 4=LOF, 5=Diverse
    last_score_ = (ENSEMBLE_WEIGHTS[0] * ((score_if_s * MODEL_NORMALIZERS[0].scale) + MODEL_NORMALIZERS[0].min)) +
                  (ENSEMBLE_WEIGHTS[1] * ((score_if_m * MODEL_NORMALIZERS[1].scale) + MODEL_NORMALIZERS[1].min));

    // Normalize final ensemble if needed (not required if sub-models are already normalized)
    
    // 4. Thresholding based on final_hybrid_v2.pkl calibration
    if (last_score_ >= THRESHOLD_RANSOMWARE) return 2; // HIGH
    if (last_score_ >= THRESHOLD_SUSPICIOUS) return 1; // MEDIUM
    
    return 0; // Benign
}

float InferenceCouncil::ScoreHBOS(const std::vector<float>& features) {
    // Placeholder: Full HBOS logic requires histogram bin exported
    return 0.5f;
}

} // namespace shield
