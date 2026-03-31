#include "feature_engine.hpp"
#include "feature_scaler.h"
#include "inference_council.h"
#include "shield_sensors.skel.h"
#include "bpf/common.h"
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

    /* Process a raw event from the BPF ring buffer */
    void OnEvent(const void* event_ptr) {
        // 1. Parse raw event
        const struct event_t* e = static_cast<const struct event_t*>(event_ptr);
        
        // 2. Feed into Feature Engine for windowing
        engine_->push_event(*e);
        
        // 3. Check for ready feature windows (sliding 60s windows)
        std::vector<FeatureVector> ready_windows = engine_->get_ready_windows();
        
        for (const auto& fv : ready_windows) {
            // 4. Robust Scaling (Pre-processing)
            std::vector<float> raw_v;
            for(int i=0; i<32; ++i) raw_v.push_back((float)fv.features[i]);
            
            auto scaled_v = scaler_->Scale(raw_v);
            
            // 5. AI Council Inference
            int level = council_->Predict(scaled_v);
            
            if (level > 0) {
                HandleThreat(fv.pid, level, fv.comm);
            }
        }
        
        // 6. Periodic maintenance
        engine_->prune_inactive_pids();
    }

private:
    void HandleThreat(uint32_t pid, int level, const char* comm) {
        if (level == 2) {
            std::cout << "[🛡️ SHIELD] RANSOMWARE ALERT (PID " << pid << ", " << comm << "): High threat score! Intercepting..." << std::endl;
        } else if (level == 1) {
            std::cout << "[🛡️ SHIELD] SUSPICIOUS ACTIVITY (PID " << pid << ", " << comm << "): Medium threat score." << std::endl;
        }
    }

    std::unique_ptr<FeatureEngine> engine_;
    std::unique_ptr<FeatureScaler> scaler_;
    std::unique_ptr<InferenceCouncil> council_;
};

} // namespace shield
