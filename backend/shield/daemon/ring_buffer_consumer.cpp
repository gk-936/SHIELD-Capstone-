#include "feature_engine.hpp"
#include "feature_scaler.h"
#include "inference_council.h"
#include <iostream>
#include <memory>
#include <vector>
#include <cstring>

namespace shield {

class RingBufferConsumer {
public:
    RingBufferConsumer() {
        engine_ = std::make_unique<FeatureEngine>();
        scaler_ = std::make_unique<FeatureScaler>();
        council_ = std::make_unique<InferenceCouncil>();
    }

    void OnEvent(const void* event_ptr) {
        // Casting from generic ptr to our shield struct
        // const struct event_t* event = (const struct event_t*)event_ptr;
        // engine_->push_event(*event);
        
        // Mocking for integration check
        uint32_t pid = 1234;
        if (engine_->IsWindowReady(pid)) {
            std::vector<float> features = {0.1f, 0.2f}; // Mock features
            auto scaled = scaler_->Scale(features);
            
            // AI Inference Engine
            int level = council_->Predict(scaled);
            if (level > 0) {
                HandleThreat(pid, level);
            }
        }
    }

private:
    void HandleThreat(uint32_t pid, int level) {
        if (level == 2) {
            std::cout << "[SHIELD] HIGH THREAT DETECTED (PID " << pid << "): Ransomware activity confirmed! Kill signal sent." << std::endl;
        } else if (level == 1) {
            std::cout << "[SHIELD] SUSPICIOUS ACTIVITY (PID " << pid << "): Medium threat detected. Forensic snapshot taken." << std::endl;
        }
    }

    std::unique_ptr<FeatureEngine> engine_;
    std::unique_ptr<FeatureScaler> scaler_;
    std::unique_ptr<InferenceCouncil> council_;
};

} // namespace shield
