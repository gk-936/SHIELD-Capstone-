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
#include <atomic>
#include <chrono>
#include "forensic_manager.hpp"

namespace shield {
    extern DashboardBridge g_dashboard;
}

namespace shield {

class RingBufferConsumer {
public:
    RingBufferConsumer() : suspend_map_fd_(-1), throttle_map_fd_(-1), total_events_(0), total_inferences_(0), last_inference_ms_(0.0) {
        engine_ = std::make_unique<FeatureEngine>();
        scaler_ = std::make_unique<FeatureScaler>();
        council_ = std::make_unique<InferenceCouncil>();
        
        // v7.5 - Initialize Persistence & Recovery
        ForensicManager::Get().Init("scripts/shield_sandbox", ".shield_vault");

        known_registry_ = {"node", "npm", "apt", "dpkg", "apt-get", "systemd", "tailscaled"};
        
        g_dashboard.SetMessageCallback([this](const std::string& msg) {
            this->OnDashboardMessage(msg);
        });
    }

    void SetBpfMaps(int suspend_map_fd, int throttle_map_fd) {
        suspend_map_fd_ = suspend_map_fd;
        throttle_map_fd_ = throttle_map_fd;
    }

    std::string GetStatusJSON(uint64_t interval_ms) {
        uint64_t events = total_events_.exchange(0);
        double eps = (events * 1000.0) / interval_ms;
        
        std::stringstream ss;
        ss << std::fixed << std::setprecision(2);
        ss << "{\"type\":\"status_update\", \"events_per_second\":" << (int)eps 
           << ", \"buffer_fill\":" << (eps > 5000 ? 85 : eps > 1000 ? 15 : 1) 
           << ", \"inferences_per_second\":" << (int)(total_inferences_.exchange(0) * 1000.0 / interval_ms)
           << ", \"mean_inference_latency\":" << last_inference_ms_.load()
           << ", \"pid_count_tracked\":" << engine_->get_active_pid_count()
           << "}";
        return ss.str();
    }

    bool IsKernelComm(const char* comm) {
        static const std::regex k_regex("^(kworker|jbd2|ext4-rsv|migration|rcu_|softirq|cpuhp).*");
        return std::regex_match(comm, k_regex);
    }

    // v7.5 Deep Trust — processes silenced BEFORE feature engine
    // Covers: system infrastructure, dev tooling, and known high-entropy benign processes
    bool IsDeepTrusted(const char* comm) {
        static const std::unordered_set<std::string> deep_trust = {
            // Core system
            "systemd", "systemd-journal", "systemd-journald", "systemd-udevd",
            "journal-offline", "dbus-daemon", "sshd", "cron", "atd",
            // Monitoring & virtualization
            "tailscaled", "vmtoolsd", "vmware-vmx", "VGAuthService",
            // Dev environment (high-entropy I/O but trusted)
            "node", "npm", "npx", "vite",
            // Shell & scripting (spawned by user, not threat)
            "bash", "sh", "zsh", "dash",
            // Package management
            "apt", "apt-get", "dpkg",
        };
        return deep_trust.count(std::string(comm)) > 0;
    }

    void ReadProcessMetrics(uint32_t pid, double &cpu, double &rss) {
        cpu = 0.0; rss = 0.0;
        std::string status_path = "/proc/" + std::to_string(pid) + "/status";
        std::ifstream status_file(status_path);
        if (status_file.is_open()) {
            std::string line;
            while (std::getline(status_file, line)) {
                if (line.compare(0, 6, "VmRSS:") == 0) {
                    std::stringstream ss(line.substr(6));
                    uint64_t kb;
                    ss >> kb;
                    rss = kb / 1024.0;
                    break;
                }
            }
        }
    }

    void OnDashboardMessage(const std::string& msg) {
        if (msg.find("\"type\":\"registry_update\"") != std::string::npos) {
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
            }
        }
    }

    void OnEvent(const void* event_ptr) {
        const struct event_t* e = static_cast<const struct event_t*>(event_ptr);
        
        if (IsKernelComm(e->comm)) return;
        
        total_events_++;
        engine_->push_event(*e);
        
        std::vector<FeatureVector> ready_windows = engine_->get_ready_windows();
        for (const auto& fv : ready_windows) {
            std::vector<float> raw_v;
            for(int i = 0; i < (int)FeatureVector::FEATURE_COUNT; ++i) {
                raw_v.push_back((float)fv.features[i]);
            }
            
            // v7.2 Deep Trust Integration
            int final_level = 0;
            float instant_score = 0.0f;
            
            if (IsDeepTrusted(fv.comm)) {
                final_level = 0;
                instant_score = 0.00f;
            } else {
                auto start_time = std::chrono::high_resolution_clock::now();
                final_level = council_->Predict(raw_v); 
                instant_score = council_->GetLastScore();
                auto end_time = std::chrono::high_resolution_clock::now();
                
                double latency = std::chrono::duration<double, std::milli>(end_time - start_time).count();
                last_inference_ms_.store(latency);
                total_inferences_++;
            }
            
            auto& history = threat_scores_[fv.pid];
            history.push_back(instant_score);
            if (history.size() > 6) history.pop_front();

            float rank_score = 0.0f;
            float weight = 1.0f;
            for (auto it = history.rbegin(); it != history.rend(); ++it) {
                rank_score += (*it) * weight;
                weight *= 0.85f;
            }
            // Clamp rank_score to 1.0 for valid visualization
            rank_score = std::min(1.0f, rank_score);

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

            std::vector<float> radar = (instant_score == 0.0f) ? std::vector<float>(6, 0.0f) : council_->GetLastRadarScores();
            std::stringstream radar_ss;
            radar_ss << "[";
            for(size_t i=0; i<radar.size(); ++i) {
                radar_ss << std::fixed << std::setprecision(2) << radar[i] << (i == radar.size()-1 ? "" : ",");
            }
            radar_ss << "]";

            std::stringstream features_ss;
            features_ss << "[";
            for(int i = 0; i < (int)FeatureVector::FEATURE_COUNT; ++i) {
                features_ss << std::fixed << std::setprecision(4) << fv.features[i] << (i == (int)FeatureVector::FEATURE_COUNT-1 ? "" : ",");
            }
            features_ss << "]";

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
               << ", \"features\":" << features_ss.str()
               << "}";
            
            g_dashboard.PushUpdate(ss.str());

            if (final_level > 0) {
                HandleThreat(fv.pid, final_level, fv.comm, cpu, rss, top_feature, rank_score, radar_ss.str());
            }
        }
        engine_->prune_inactive_pids();
    }

private:
    void HandleThreat(uint32_t pid, int level, const char* comm, double cpu, double rss, std::string top_feature, float score, std::string radar_json) {
        if (pid < 1000) return;

        // Alert Cooldown: 30 seconds per PID to prevent alert storm
        auto now = std::chrono::steady_clock::now();
        auto cit = alert_cooldown_.find(pid);
        if (cit != alert_cooldown_.end()) {
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - cit->second).count();
            if (elapsed < 30) return;
        }
        alert_cooldown_[pid] = now;

        bool is_known = known_registry_.count(std::string(comm)) > 0;
        std::string outcome = "Neutralized";

        if (level == 2) {
            if (is_known) {
                if (throttle_map_fd_ != -1) {
                    struct throttle_cfg cfg = { .rate_limit_bps = 512 * 1024, .current_window_start = 0, .bytes_in_current_window = 0 };
                    bpf_map_update_elem(throttle_map_fd_, &pid, &cfg, BPF_ANY);
                    outcome = "Throttled";
                    level = 1; 
                }
            } else {
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
           << "\", \"score\":" << score
           << ", \"radar\":" << radar_json
           << ", \"outcome\":\"" << outcome
           << "\", \"cpu\":" << cpu
           << ", \"mem\":" << rss
           << ", \"top_feature\":\"" << top_feature << "\""
           << ", \"technique\":\"T1486\", \"description\":\"Active Blockade Policy Applied\"}";
        
        std::string alert_json = ss.str();
        ForensicManager::Get().LogAlert(alert_json);
        g_dashboard.PushUpdate(alert_json);

        // Stage 5 Rollback: Snapshot on first suspicious level
        if (level == 1) {
            ForensicManager::Get().CreateSnapshot(pid, comm);
        }
    }

    std::unique_ptr<FeatureEngine> engine_;
    std::unique_ptr<FeatureScaler> scaler_;
    std::unique_ptr<InferenceCouncil> council_;
    std::map<uint32_t, std::deque<float>> threat_scores_;
    std::unordered_set<std::string> known_registry_;
    std::map<uint32_t, std::chrono::steady_clock::time_point> alert_cooldown_;
    int suspend_map_fd_;
    int throttle_map_fd_;
    std::atomic<uint64_t> total_events_;
    std::atomic<uint64_t> total_inferences_;
    std::atomic<double> last_inference_ms_;
};

static RingBufferConsumer g_consumer;

static int handle_event(void *ctx, void *data, size_t data_sz) {
    g_consumer.OnEvent(data);
    return 0;
}

void SetBpfSensorMaps(int suspend_fd, int throttle_fd) {
    g_consumer.SetBpfMaps(suspend_fd, throttle_fd);
}

std::string GetSystemStatusJSON(uint64_t interval_ms) {
    return g_consumer.GetStatusJSON(interval_ms);
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
