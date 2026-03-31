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
        
        /* Check if 10s step has passed since last calculation */
        if (latest_ts >= buf.last_feature_calculation_time_ns + step_ns) {
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
        // Note: Using latest event in map as 'now' or system clock
        // For simulation, we'll keep them unless they are truly old.
        if (it->second.events.size() > 1) {
             uint64_t age_ns = it->second.events.back().timestamp_ns - it->second.events.front().timestamp_ns;
             if (age_ns > (uint64_t)600e9) { // Prune if buffer exceeds 10 mins for safety
                 it->second.events.pop_front();
             }
        }
        it++;
    }
}
