#ifndef __SHIELD_FEATURE_ENGINE_HPP
#define __SHIELD_FEATURE_ENGINE_HPP

#include <vector>
#include <deque>
#include <map>
#include <mutex>
#include <chrono>
#include "feature_types.h"
#include "../../bpf/common.h"

class FeatureEngine {
public:
    FeatureEngine(double window_duration = 60.0, double step_interval = 10.0);
    ~FeatureEngine();

    /* Push a raw event from BPF into the PID buffer */
    void push_event(const struct event_t &event);

    /* Process all active PIDs and compute feature vectors if window is ready */
    std::vector<FeatureVector> get_ready_windows();

    /* Cleanup inactive PIDs (300s timeout as per doc) */
    void prune_inactive_pids();

    /* Get count of active monitored PIDs */
    size_t get_active_pid_count();

private:
    struct InternalEvent {
        uint64_t timestamp_ns;
        uint64_t addr;
        uint32_t size;
        uint32_t entropy;
        uint32_t op_type;
    };

    struct PIDBuffer {
        char comm[16];
        std::deque<InternalEvent> events;
        uint64_t last_event_time_ns;
        uint64_t last_feature_calculation_time_ns;
    };

    std::map<uint32_t, PIDBuffer> pid_map_;
    std::mutex map_mutex_;

    double window_duration_s_;   /* default 60s */
    double step_interval_s_;     /* default 10s */

    /* Individual feature computation helper */
    FeatureVector calculate_features(uint32_t pid, const PIDBuffer &buffer);
};

#endif /* __SHIELD_FEATURE_ENGINE_HPP */
