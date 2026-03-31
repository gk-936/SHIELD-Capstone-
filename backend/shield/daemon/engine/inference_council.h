#ifndef INFERENCE_COUNCIL_H
#define INFERENCE_COUNCIL_H

#include <vector>
#include <string>
#include "model_weights.h"

namespace shield {

class InferenceCouncil {
public:
    InferenceCouncil();
    ~InferenceCouncil() = default;

    /**
     * @brief Predict the threat level based on normalized feature vector.
     * @return int 0: Benign, 1: Suspicious (Medium), 2: Ransomware (High)
     */
    int Predict(const std::vector<float>& features);

    float GetLastScore() const { return last_score_; }

private:
    // Model scoring methods
    float ScoreIsolationForest(const IFNode* const* trees, int tree_count, const std::vector<float>& features);
    float ScoreHBOS(const std::vector<float>& features);

    float last_score_;
};

} // namespace shield

#endif // INFERENCE_COUNCIL_H
