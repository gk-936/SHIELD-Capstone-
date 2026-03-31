#ifndef __SHIELD_FEATURE_SCALER_H
#define __SHIELD_FEATURE_SCALER_H

#include <vector>
#include <string>
#include <fstream>
#include <iostream>
#include "feature_types.h"
#include "model_weights.h"

namespace shield {

class FeatureScaler {
public:
    FeatureScaler() {}

    /**
     * @brief Scales a raw feature vector using RobustScaler (Median/IQR)
     *        parameters from model_weights.h
     */
    std::vector<float> Scale(const std::vector<float>& raw_features) {
        std::vector<float> scaled = raw_features;
        
        // Storage features (0-9)
        for (int i = 0; i < STORAGE_FEAT_COUNT && i < (int)scaled.size(); ++i) {
            if (SCALER_S_SCALE[i] != 0) {
                scaled[i] = (scaled[i] - SCALER_S_CENTER[i]) / SCALER_S_SCALE[i];
            } else {
                scaled[i] = (scaled[i] - SCALER_S_CENTER[i]);
            }
        }
        
        // Memory features (10-15)
        for (int i = 0; i < MEMORY_FEAT_COUNT && (i + STORAGE_FEAT_COUNT) < (int)scaled.size(); ++i) {
            int idx = i + STORAGE_FEAT_COUNT;
            if (SCALER_M_SCALE[i] != 0) {
                scaled[idx] = (scaled[idx] - SCALER_M_CENTER[i]) / SCALER_M_SCALE[i];
            } else {
                scaled[idx] = (scaled[idx] - SCALER_M_CENTER[i]);
            }
        }
        
        return scaled;
    }
};

} // namespace shield

#endif // __SHIELD_FEATURE_SCALER_H
