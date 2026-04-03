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
#include <regex>
#include <unistd.h>

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

    bool IsKernelComm(const char* comm) {
        static const std::regex k_regex("^(kworker|jbd2|ext4-rsv|migration|rcu_|softirq|cpuhp).*");
        return std::regex_match(comm, k_regex);
    }

    void ReadProcessMetrics(uint32_t pid, double &cpu, double &rss) {
        cpu = 0.0; rss = 0.0;
        
        // 1. Read RSS from /proc/[pid]/status
        std::string status_path = "/proc/" + std::to_string(pid) + "/status";
        std::ifstream status_file(status_path);
        if (status_file.is_open()) {
            std::string line;
            while (std::getline(status_file, line)) {
                if (line.compare(0, 6, "VmRSS:") == 0) {
                    std::stringstream ss(line.substr(6));
                    uint64_t kb;
                    ss >> kb;
                    rss = kb / 1024.0; // MB
                    break;
                }
            }
        }

        // 2. Read CPU from /proc/[pid]/stat (Simplified snapshot)
        std::string stat_path = "/proc/" + std::to_string(pid) + "/stat";
        std::ifstream stat_file(stat_path);
        if (stat_file.is_open()) {
            std::string tmp;
            for(int i=0; i<13; ++i) stat_file >> tmp; // Skip to utime
            uint64_t utime, stime;
            stat_file >> utime >> stime;
            cpu = (double)(utime + stime) / sysconf(_SC_CLK_TCK); 
            // Note: This is total CPU time, not instantaneous percentage. 
            // In a full implementation, we'd compare against previous snapshots.
        }
    }

    void OnDashboardMessage(const std::string& msg) {
        if (msg.find("\"type\":\"registry_update\"") != std::string::npos) {
            std::cout << "[🛡️] Dashboard updated Known-Process Registry." << std::endl;
            
            std::unordered_set<std::string> new_registry;
            size_t list_start = msg.find("[");
            size_t list_end = msg.find("]");
            if (list_start != std::string::npos && list_end != std::string::npos) {
                std::string list_content = msg.substr(list_start + 1, list_end - list_start - 1);
                std::stringstream ss(list_content);
                std::string item;
                while (std::getline(ss, item, ',')) {
                    item.erase(std::remove(item.begin(), item.end(), '\"'), item.end());
                    item.erase(std::remove(item.begin(), item.end(), ' '), item.end());
                    if (!item.empty()) new_registry.insert(item);
                }
                known_registry_ = new_registry;
                std::cout << "[🛡️] Registry synchronized: " << known_registry_.size() << " processes trusted." << std::endl;
            }
        }
    }

    void OnEvent(const void* event_ptr) {
        const struct event_t* e = static_cast<const struct event_t*>(event_ptr);
        
        // Immediate Kernel Filter (No scoring for kernel threads)
        if (IsKernelComm(e->comm)) return;
        
        engine_->push_event(*e);
        
        std::vector<FeatureVector> ready_windows = engine_->get_ready_windows();
        for (const auto& fv : ready_windows) {
            std::vector<float> raw_v;
            for(int i = 0; i < (int)FeatureVector::FEATURE_COUNT; ++i) {
                raw_v.push_back((float)fv.features[i]);
            }
            
            int final_level = council_->Predict(raw_v); 
            float instant_score = council_->GetLastScore();
            
            auto& history = threat_scores_[fv.pid];
            history.push_back(instant_score);
            if (history.size() > 6) history.pop_front();

            float rank_score = 0.0f;
            float weight = 1.0f;
            for (auto it = history.rbegin(); it != history.rend(); ++it) {
                rank_score += (*it) * weight;
                weight *= 0.85f;
            }

            double cpu = 0.0, rss = 0.0;
            ReadProcessMetrics(fv.pid, cpu, rss);
            
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

            std::vector<float> radar = council_->GetLastRadarScores();
            std::stringstream radar_ss;
            radar_ss << "[";
            for(size_t i=0; i<radar.size(); ++i) {
                radar_ss << std::fixed << std::setprecision(2) << radar[i] << (i == radar.size()-1 ? "" : ",");
            }
            radar_ss << "]";

            std::stringstream ss;
            ss << std::fixed << std::setprecision(2);
            ss << "{\"type\":\"window_update\", \"pid\":" << fv.pid 
               << ", \"comm\":\"" << fv.comm 
               << "\", \"score\":" << rank_score 
               << ", \"instant_score\":" << instant_score
               << ", \"level\":" << (int)final_level
               << ", \"cpu\":" << cpu
               << ", \"mem\":" << rss
               << ", \"top_feature\":\"" << top_feature << "\""
               << ", \"top_value\":" << max_val 
               << ", \"radar\":" << radar_ss.str()
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
        if (pid < 1000) return; 

        bool is_known = known_registry_.count(std::string(comm)) > 0;
        std::string outcome = "Neutralized";

        if (level == 2) {
            if (is_known) {
                std::cout << "[🛡️] Known-Process Match (" << comm << "). Initiating BPF Throttling..." << std::endl;
                if (throttle_map_fd_ != -1) {
                    struct throttle_cfg cfg = { .rate_limit_bps = 512 * 1024, .current_window_start = 0, .bytes_in_current_window = 0 };
                    bpf_map_update_elem(throttle_map_fd_, &pid, &cfg, BPF_ANY);
                    outcome = "Throttled";
                    level = 1; 
                }
            } else {
                std::cout << "[🛡️] RANSOMWARE ALERT (PID " << pid << ", " << comm << "). Neutralizing..." << std::endl;
                kill(pid, SIGKILL);
                if (suspend_map_fd_ != -1) {
                    unsigned int val = 1;
                    bpf_map_update_elem(suspend_map_fd_, &pid, &val, BPF_ANY);
                }
            }
        } else if (level == 1) {
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
           << ", \"top_feature\":\"" << top_feature << "\""
           << ", \"technique\":\"T1486\", \"description\":\"Active Blockade Policy Applied\"}";
        
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
