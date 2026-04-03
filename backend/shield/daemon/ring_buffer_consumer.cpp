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


namespace shield {
    extern DashboardBridge g_dashboard;
}

namespace shield {

class RingBufferConsumer {
public:
    RingBufferConsumer() : suspend_map_fd_(-1) {
        engine_ = std::make_unique<FeatureEngine>();
        scaler_ = std::make_unique<FeatureScaler>();
        council_ = std::make_unique<InferenceCouncil>();
    }

    void SetBpfMaps(int suspend_map_fd) {
        suspend_map_fd_ = suspend_map_fd;
    }


    void OnEvent(const void* event_ptr) {
        const struct event_t* e = static_cast<const struct event_t*>(event_ptr);
        engine_->push_event(*e);
        
        std::vector<FeatureVector> ready_windows = engine_->get_ready_windows();
        for (const auto& fv : ready_windows) {
            std::vector<float> raw_v;
            for(int i = 0; i < FeatureVector::FEATURE_COUNT; ++i) {
                raw_v.push_back((float)fv.features[i]);
            }
            
            int level = council_->Predict(raw_v);
            float real_score = council_->GetLastScore();
            
            // Recency-weighted sliding window (v7.0 Tuning)
            auto& history = threat_scores_[fv.pid];
            history.push_back(real_score);
            if (history.size() > 6) history.pop_front(); // 60s window (assuming 10s steps)

            float rank_score = 0.0f;
            float weight = 1.0f;
            float total_weight = 0.0f;
            for (auto it = history.rbegin(); it != history.rend(); ++it) {
                rank_score += (*it) * weight;
                total_weight += weight;
                weight *= 0.85f; // Recency decay factor
            }
            // Scale rank score to reflect accumulation
            // If sustained 0.48 for 2 windows, rank_score = 0.48*1.0 + 0.48*0.85 = 0.888 (> 0.59)
            // If just 1 window of 0.48, rank_score = 0.48 (> 0.35)

            int final_level = 0;
            if (rank_score >= THRESHOLD_RANSOMWARE) final_level = 2; // HIGH (0.59)
            else if (rank_score >= THRESHOLD_SUSPICIOUS) final_level = 1; // MEDIUM (0.35)

            double cpu = 0.0, rss = 0.0;
            // GetProcessMetrics(fv.pid, cpu, rss);
            
            std::string top_feature = "Normal Activity";
            // ... (keep top_feature logic)
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
                    case 3: top_feature = "High Entropy"; break; // MEAN_ENTROPY
                    case 5: top_feature = "I/O Acceleration"; break; // IO_ACCELERATION
                    case 16: top_feature = "Write Intensive"; break; // WRITE_SIZE_UNIFORMITY
                    case 7: top_feature = "Broad Encryption"; break; // UNIQUE_BLOCKS
                    default: top_feature = "Behavioral Anomaly"; break;
                }
            }

            std::stringstream ss;
            ss << std::fixed << std::setprecision(2);
            // Send both instantaneous score and sliding rank score
            ss << "{\"type\":\"window_update\", \"pid\":" << fv.pid 
               << ", \"comm\":\"" << fv.comm 
               << "\", \"score\":" << rank_score 
               << ", \"instant_score\":" << real_score
               << ", \"level\":" << final_level
               << ", \"cpu\":" << cpu
               << ", \"mem\":" << rss
               << ", \"top_feature\":\"" << top_feature << "\""
               << ", \"top_value\":" << max_val 
               << ", \"radar\":" << "[0.1, 0.2, 0.3, 0.4, 0.5, 0.6]" // Radar placeholder
               << "}";
            
            g_dashboard.PushUpdate(ss.str());

            if (final_level > 0) {
                HandleThreat(fv.pid, final_level, fv.comm, cpu, rss, top_feature);
            }
        }
        engine_->prune_inactive_pids();
    }

private:
    void GetProcessMetrics(uint32_t pid, double &cpu, double &rss_mb) {
        std::string path = "/proc/" + std::to_string(pid) + "/stat";
        std::ifstream stat_file(path);
        if (!stat_file.is_open()) return;

        std::string tmp;
        unsigned long utime, stime, rss_pages;
        for(int i=0; i<13; i++) stat_file >> tmp;
        stat_file >> utime >> stime;
        for(int i=0; i<8; i++) stat_file >> tmp;
        stat_file >> rss_pages;

        rss_mb = (rss_pages * 4.0) / 1024.0; 
        cpu = ((double)(utime + stime) / 100.0);
    }

    bool IsKernelProcess(uint32_t pid, const char* comm) {
        if (pid < 1000) return true;
        std::string name(comm);
        if (name.find("kworker") == 0) return true;
        if (name.find("jbd2") == 0) return true;
        if (name.find("ext4-rsv-conver") == 0) return true;
        return false;
    }

    void HandleThreat(uint32_t pid, int level, const char* comm, double cpu, double rss, std::string top_feature) {
        if (IsKernelProcess(pid, comm)) return;

        if (level == 2) {
            std::cout << "[🛡️ SHIELD] RANSOMWARE ALERT (PID " << pid << ", " << comm << "): High threat score! Intercepting..." << std::endl;
            
            /* 1. Neutralize: Send SIGKILL */
            std::cout << "[🛡️ SHIELD] Sending SIGKILL to PID " << pid << "..." << std::endl;
            kill(pid, SIGKILL);

            /* 2. Suspend: Block in BPF map to prevent remaining threads */
            if (suspend_map_fd_ != -1) {
                unsigned int val = 1;
                bpf_map_update_elem(suspend_map_fd_, &pid, &val, BPF_ANY);
                std::cout << "[🛡️ SHIELD] PID " << pid << " added to kernel suspend_map." << std::endl;
            }
        } else if (level == 1) {
            std::cout << "[🛡️ SHIELD] SUSPICIOUS ACTIVITY (PID " << pid << ", " << comm << "): Medium threat score. Consensus achieved." << std::endl;
        }

        std::stringstream ss;
        ss << std::fixed << std::setprecision(2);
        ss << "{\"type\":\"alert_update\", \"pid\":" << pid 
           << ", \"comm\":\"" << comm 
           << "\", \"level\":\"" << (level == 2 ? "HIGH" : "MEDIUM") 
           << "\", \"cpu\":" << cpu
           << ", \"mem\":" << rss
           << ", \"top_feature\":\"" << top_feature
           << "\", \"technique\":\"T1486\", \"description\":\"Data Encrypted for Impact\"}";
        
        g_dashboard.PushUpdate(ss.str());
    }


    std::unique_ptr<FeatureEngine> engine_;
    std::unique_ptr<FeatureScaler> scaler_;
    std::unique_ptr<InferenceCouncil> council_;
    std::map<uint32_t, std::deque<float>> threat_scores_;
    int suspend_map_fd_;

};

static RingBufferConsumer g_consumer;

static int handle_event(void *ctx, void *data, size_t data_sz) {
    g_consumer.OnEvent(data);
    return 0;
}

void SetBpfSensorMaps(int suspend_fd) {
    g_consumer.SetBpfMaps(suspend_fd);
}

} // namespace shield

extern "C" int handle_ring_buffer(struct shield_sensors_bpf *skel) {

    struct ring_buffer *rb = NULL;
    int err;
    rb = ring_buffer__new(bpf_map__fd(skel->maps.rb), shield::handle_event, NULL, NULL);
    if (!rb) {
        fprintf(stderr, "Failed to create ring buffer\n");
        return -1;
    }
    while (true) {
        err = ring_buffer__poll(rb, 100);
        if (err == -EINTR) continue;
        if (err < 0) break;
    }
    ring_buffer__free(rb);
    return err;
}
