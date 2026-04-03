#include "engine/feature_engine.hpp"
#include "engine/feature_scaler.h"
#include "engine/inference_council.h"
#include "dashboard_bridge.hpp"
#include "shield_sensors.skel.h"
#include "bpf/common.h"
#include <iostream>
#include <memory>
#include <vector>
#include <map>
#include <deque>
#include <cstdint>
#include <cstring>
#include <string>
#include <algorithm>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <bpf/libbpf.h>
#include <bpf/bpf.h>
#include <csignal>
#include <linux/bpf.h>
#include <unordered_set>

namespace shield {
    extern DashboardBridge g_dashboard;
}

namespace shield {

class RingBufferConsumer {
public:
    RingBufferConsumer() : suspend_map_fd_(-1), throttle_map_fd_(-1) {
        engine_ = std::make_unique<FeatureEngine>();
        scaler_ = std::make_unique<FeatureScaler>();
        council_ = std::make_unique<InferenceCouncil>();
        
        // Default Known-Process Registry
        known_registry_ = {"node", "npm", "apt", "dpkg", "apt-get", "systemd", "tailscaled"};
        
        g_dashboard.SetMessageCallback([this](const std::string& msg) {
            this->OnDashboardMessage(msg);
        });
    }

    void SetBpfMaps(int suspend_map_fd, int throttle_map_fd) {
        suspend_map_fd_ = suspend_map_fd;
        throttle_map_fd_ = throttle_map_fd;
    }

    void OnDashboardMessage(const std::string& msg) {
        if (msg.find("\"type\":\"registry_update\"") != std::string::npos) {
            std::cout << "[🛡️] Dashboard updated Known-Process Registry." << std::endl;
            
            // Very simple manual parsing of ["a","b"] format
            std::unordered_set<std::string> new_registry;
            size_t list_start = msg.find("[");
            size_t list_end = msg.find("]");
            if (list_start != std::string::npos && list_end != std::string::npos) {
                std::string list_content = msg.substr(list_start + 1, list_end - list_start - 1);
                std::stringstream ss(list_content);
                std::string item;
                while (std::getline(ss, item, ',')) {
                    // Remove quotes and whitespace
                    item.erase(std::remove(item.begin(), item.end(), '\"'), item.end());
                    item.erase(std::remove(item.begin(), item.end(), ' '), item.end());
                    if (!item.empty()) new_registry.insert(item);
                }
                known_registry_ = new_registry;
                std::cout << "[🛡️] Registry synchronized: " << known_registry_.size() << " processes trusted for throttling." << std::endl;
            }
        }
    }

    void OnEvent(const void* event_ptr) {
        const struct event_t* e = static_cast<const struct event_t*>(event_ptr);
        engine_->push_event(*e);
        
        std::vector<FeatureVector> ready_windows = engine_->get_ready_windows();
        for (const auto& fv : ready_windows) {
            std::vector<float> raw_v;
            for(int i = 0; i < (int)FeatureVector::FEATURE_COUNT; ++i) {
                raw_v.push_back((float)fv.features[i]);
            }
            
            council_->Predict(raw_v); // Instantaneous prediction results are updated in council state
            float real_score = council_->GetLastScore();
            
            auto& history = threat_scores_[fv.pid];
            history.push_back(real_score);
            if (history.size() > 6) history.pop_front();

            float rank_score = 0.0f;
            float weight = 1.0f;
            for (auto it = history.rbegin(); it != history.rend(); ++it) {
                rank_score += (*it) * weight;
                weight *= 0.85f;
            }

            int final_level = 0;
            if (rank_score >= 0.59f) final_level = 2; // HIGH
            else if (rank_score >= 0.35f) final_level = 1; // MEDIUM

            double cpu = 0.0, rss = 0.0;
            // GetProcessMetrics(fv.pid, cpu, rss);
            
            std::string top_feature = "Normal Activity";
            double max_val = -1.0;
            int top_idx = -1;
            for(int i = 0; i < (int)raw_v.size(); i++) {
                if(raw_v[i] > max_val) {
                    max_val = raw_v[i];
                    top_idx = i;
                }
            }

            if(max_val > 0.5) {
                switch(top_idx) {
                    case 3: top_feature = "High Entropy"; break;
                    case 5: top_feature = "I/O Acceleration"; break;
                    case 16: top_feature = "Write Intensive"; break;
                    case 7: top_feature = "Broad Encryption"; break;
                    default: top_feature = "Behavioral Anomaly"; break;
                }
            }

            std::stringstream ss;
            ss << std::fixed << std::setprecision(2);
            ss << "{\"type\":\"window_update\", \"pid\":" << fv.pid 
               << ", \"comm\":\"" << fv.comm 
               << "\", \"score\":" << rank_score 
               << ", \"instant_score\":" << real_score
               << ", \"level\":" << final_level
               << ", \"cpu\":" << cpu
               << ", \"mem\":" << rss
               << ", \"top_feature\":\"" << top_feature << "\""
               << ", \"top_value\":" << max_val 
               << ", \"radar\":" << "[0.1, 0.2, 0.3, 0.4, 0.5, 0.6]"
               << "}";
            
            g_dashboard.PushUpdate(ss.str());

            if (final_level > 0) {
                HandleThreat(fv.pid, final_level, fv.comm, cpu, rss, top_feature);
            }
        }
        engine_->prune_inactive_pids();
    }

private:
    void HandleThreat(uint32_t pid, int level, const char* comm, double cpu, double rss, std::string top_feature) {
        if (pid < 1000) return; // Basic kernel/system protection

        bool is_known = known_registry_.count(std::string(comm)) > 0;
        std::string outcome = "Neutralized";

        if (level == 2) {
            if (is_known) {
                std::cout << "[🛡️] Known-Process Match (" << comm << "). Overriding HIGH -> MEDIUM. Initiating Throttling..." << std::endl;
                
                // Initiate Throttling in BPF
                if (throttle_map_fd_ != -1) {
                    struct throttle_cfg cfg = {
                        .rate_limit_bps = 512 * 1024, // 512 KB/s
                        .current_window_start = 0,
                        .bytes_in_current_window = 0
                    };
                    bpf_map_update_elem(throttle_map_fd_, &pid, &cfg, BPF_ANY);
                    outcome = "Throttled";
                    level = 1; // Downgrade to MEDIUM for dashboard
                }
            } else {
                std::cout << "[🛡️] RANSOMWARE ALERT (PID " << pid << ", " << comm << "). Intercepting..." << std::endl;
                kill(pid, SIGKILL);
                if (suspend_map_fd_ != -1) {
                    unsigned int val = 1;
                    bpf_map_update_elem(suspend_map_fd_, &pid, &val, BPF_ANY);
                }
            }
        } else if (level == 1) {
            std::cout << "[🛡️] SUSPICIOUS ACTIVITY (PID " << pid << ", " << comm << "). Monitoring window active." << std::endl;
            outcome = "Monitoring";
        }

        std::stringstream ss;
        ss << std::fixed << std::setprecision(2);
        ss << "{\"type\":\"alert_update\", \"pid\":" << pid 
           << ", \"comm\":\"" << comm 
           << "\", \"level\":\"" << (level == 2 ? "HIGH" : "MEDIUM") 
           << "\", \"outcome\":\"" << outcome
           << "\", \"cpu\":" << cpu
           << ", \"mem\":" << rss
           << "\", \"top_feature\":\"" << top_feature
           << "\", \"technique\":\"T1486\", \"description\":\"Data Encrypted for Impact\"}";
        
        g_dashboard.PushUpdate(ss.str());
    }

    std::unique_ptr<FeatureEngine> engine_;
    std::unique_ptr<FeatureScaler> scaler_;
    std::unique_ptr<InferenceCouncil> council_;
    std::map<uint32_t, std::deque<float>> threat_scores_;
    std::unordered_set<std::string> known_registry_;
    int suspend_map_fd_;
    int throttle_map_fd_;
};

static RingBufferConsumer g_consumer;

static int handle_event(void *ctx, void *data, size_t data_sz) {
    g_consumer.OnEvent(data);
    return 0;
}

void SetBpfSensorMaps(int suspend_fd, int throttle_fd) {
    g_consumer.SetBpfMaps(suspend_fd, throttle_fd);
}

} // namespace shield

extern "C" int handle_ring_buffer(struct shield_sensors_bpf *skel) {
    struct ring_buffer *rb = NULL;
    int err;
    rb = ring_buffer__new(bpf_map__fd(skel->maps.rb), shield::handle_event, NULL, NULL);
    if (!rb) return -1;
    while (true) {
        err = ring_buffer__poll(rb, 100);
        if (err == -EINTR) continue;
        if (err < 0) break;
    }
    ring_buffer__free(rb);
    return err;
}
