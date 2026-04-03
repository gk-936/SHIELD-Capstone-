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
    const std::vector<float>& GetLastRadarScores() const { return last_radar_scores_; }

private:
    float ScoreIForest(const std::vector<float>& features, const struct IFNode* tree_base, int tree_count);
    float ScoreHBOS(const std::vector<float>& features);
    float ScoreLOF(const std::vector<float>& features);
    float ScoreXGBoost(const std::vector<float>& g_features);

    float last_score_;
    std::vector<float> last_radar_scores_;
};

} // namespace shield

#endif // INFERENCE_COUNCIL_H
