#include "feature_engine.hpp"
#include "feature_scaler.h"
#include "inference_council.h"
#include "shield_sensors.skel.h"
#include "bpf/common.h"
#include <iostream>
#include <memory>
#include <vector>
#include <cstring>
#include <bpf/libbpf.h>

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
        const struct event_t* e = static_cast<const struct event_t*>(event_ptr);
        
        engine_->push_event(*e);
        
        std::vector<FeatureVector> ready_windows = engine_->get_ready_windows();
        for (const auto& fv : ready_windows) {
            std::vector<float> raw_v;
            for(int i=0; i<32; ++i) raw_v.push_back((float)fv.features[i]);
            
            auto scaled_v = scaler_->Scale(raw_v);
            int level = council_->Predict(scaled_v);
            
            if (level > 0) {
                HandleThreat(fv.pid, level, fv.comm);
            }
        }
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

/* Global instance for the BPF callback */
static RingBufferConsumer g_consumer;

static int handle_event(void *ctx, void *data, size_t data_sz) {
    g_consumer.OnEvent(data);
    return 0;
}

} // namespace shield

/* C-bridge to connect loader.cpp to the C++ consumer */
extern "C" int handle_ring_buffer(struct shield_sensors_bpf *skel) {
    struct ring_buffer *rb = NULL;
    int err;

    /* Set up ring buffer polling */
    rb = ring_buffer__new(bpf_map__fd(skel->maps.rb), shield::handle_event, NULL, NULL);
    if (!rb) {
        fprintf(stderr, "Failed to create ring buffer\n");
        return -1;
    }

    while (true) {
        err = ring_buffer__poll(rb, 100 /* ms */);
        /* Ctrl-C handled by loader.cpp global state */
        if (err == -EINTR) continue;
        if (err < 0) {
            printf("Error polling ring buffer: %d\n", err);
            break;
        }
    }

    ring_buffer__free(rb);
    return err;
}
