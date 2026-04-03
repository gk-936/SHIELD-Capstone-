#include "feature_engine.hpp"
#include <cstring>

FeatureEngine::FeatureEngine(double window_duration, double step_interval)
    : window_duration_s_(window_duration), step_interval_s_(step_interval) {}

FeatureEngine::~FeatureEngine() {}

void FeatureEngine::push_event(const struct event_t &e) {
    std::lock_guard<std::mutex> lock(map_mutex_);
    
    auto &buf = pid_map_[e.pid];
    
    /* On first event for this PID, initialize comm */
    if (buf.events.empty()) {
        memcpy(buf.comm, e.comm, 16);
        buf.last_feature_calculation_time_ns = e.timestamp_ns;
    }
    
    InternalEvent ie = {
        .timestamp_ns = e.timestamp_ns,
        .addr = e.addr,
        .size = e.size,
        .entropy = e.entropy,
        .op_type = (uint32_t)e.op_type
    };
    
    buf.events.push_back(ie);
    buf.last_event_time_ns = e.timestamp_ns;
    
    /* Cap buffer size to avoid memory exhaustion (as per doc: 500k) */
    if (buf.events.size() > 500000) {
        buf.events.pop_front();
    }
}

std::vector<FeatureVector> FeatureEngine::get_ready_windows() {
    std::lock_guard<std::mutex> lock(map_mutex_);
    std::vector<FeatureVector> results;
    
    uint64_t step_ns = (uint64_t)(step_interval_s_ * 1e9);
    
    for (auto &pair : pid_map_) {
        uint32_t pid = pair.first;
        auto &buf = pair.second;
        
        if (buf.events.empty()) continue;
        
        uint64_t latest_ts = buf.events.back().timestamp_ns;
        
        /* 
         * Check if window is ready. Two triggers:
         * 1. Time-based: 100ms has elapsed since last window
         * 2. Event-based: Ultra-fast ransomware (like ransomtest.py) can encrypt 100 files in <50ms,
         *    meaning it never hits the time threshold. Force a window if >30 events pile up.
         */
        bool time_ready = (latest_ts >= buf.last_feature_calculation_time_ns + step_ns);
        bool events_ready = (buf.events.size() >= 30 && latest_ts == buf.events.back().timestamp_ns);
        
        // Count how many events since we last calculated (estimate by finding first event strictly after calculation)
        int new_events = 0;
        for (auto it = buf.events.rbegin(); it != buf.events.rend(); ++it) {
            if (it->timestamp_ns <= buf.last_feature_calculation_time_ns) break;
            new_events++;
        }

        if (time_ready || new_events >= 30) {
            results.push_back(calculate_features(pid, buf));
            buf.last_feature_calculation_time_ns = latest_ts;
        }
    }
    
    return results;
}

void FeatureEngine::prune_inactive_pids() {
    std::lock_guard<std::mutex> lock(map_mutex_);
    
    auto it = pid_map_.begin();
    while (it != pid_map_.end()) {
        /* Prune after 300s of inactivity as per design doc */
        if (it->second.events.size() > 1) {
             uint64_t age_ns = it->second.events.back().timestamp_ns - it->second.events.front().timestamp_ns;
             if (age_ns > (uint64_t)600e9) { 
                 it->second.events.pop_front();
             }
        }
        it++;
    }
}

size_t FeatureEngine::get_active_pid_count() {
    std::lock_guard<std::mutex> lock(map_mutex_);
    return pid_map_.size();
}
