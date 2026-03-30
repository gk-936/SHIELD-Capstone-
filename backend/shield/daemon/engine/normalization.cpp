#include "feature_types.h"
#include <vector>
#include <fstream>
#include <iostream>

class FeatureScaler {
public:
    FeatureScaler() : count_(0) {}

    bool load(const std::string& path) {
        std::ifstream f(path, std::ios::binary);
        if (!f) return false;

        f.read(reinterpret_cast<char*>(&count_), sizeof(count_));
        if (count_ != 32) {
            std::cerr << "Warning: Scaler expecting 32 features, got " << count_ << std::endl;
        }

        medians_.resize(count_);
        iqrs_.resize(count_);

        for (uint32_t i = 0; i < count_; ++i) f.read(reinterpret_cast<char*>(&medians_[i]), sizeof(double));
        for (uint32_t i = 0; i < count_; ++i) f.read(reinterpret_cast<char*>(&iqrs_[i]), sizeof(double));

        return true;
    }

    void scale(FeatureVector& fv) {
        for (uint32_t i = 0; i < count_ && i < 32; ++i) {
            if (iqrs_[i] != 0) {
                fv.features[i] = (fv.features[i] - medians_[i]) / iqrs_[i];
            } else {
                fv.features[i] = (fv.features[i] - medians_[i]);
            }
        }
    }

private:
    uint32_t count_;
    std::vector<double> medians_;
    std::vector<double> iqrs_;
};

/* Singleton access or helper for globally loaded scaler */
static FeatureScaler g_scaler;

bool load_global_scaler(const std::string& path) {
    return g_scaler.load(path);
}

void apply_global_scaling(FeatureVector& fv) {
    g_scaler.scale(fv);
}
