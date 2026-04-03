#include "feature_engine.hpp"
#include <cstring>
#include <algorithm>
#include <numeric>
#include <cmath>
#include <map>
#include <set>

#define NS_TO_SEC 1e9

// Pre-define log1p helper for clarity
static double log1p_f(double x) {
    return std::log1p(x);
}

// Helper: Calculate Standard Deviation
static double calculate_std_dev(const std::vector<double>& v, double mean) {
    if (v.empty()) return 0.0;
    double sq_sum = 0;
    for (double val : v) sq_sum += (val - mean) * (val - mean);
    return std::sqrt(sq_sum / v.size());
}

FeatureVector FeatureEngine::calculate_features(uint32_t pid, const PIDBuffer &buffer) {
    FeatureVector fv = {};
    fv.pid = pid;
    memcpy(fv.comm, buffer.comm, 16);

    const auto &events = buffer.events;
    if (events.empty()) return fv;

    /* Filter events within the 60s window */
    uint64_t now_ns = events.back().timestamp_ns;
    uint64_t window_start_ns = now_ns - (uint64_t)(window_duration_s_ * NS_TO_SEC);
    
    std::vector<InternalEvent> win_events;
    for (const auto &e : events) {
        if (e.timestamp_ns >= window_start_ns) {
            win_events.push_back(e);
        }
    }

    if (win_events.empty()) return fv;

    size_t n = win_events.size();
    
    /* 1. Volume features */
    double total_bytes = 0;
    double read_count = 0, write_count = 0;
    std::vector<double> write_sizes;
    std::vector<double> entropies;
    std::vector<double> inter_arrival_times;
    
    for (size_t i = 0; i < win_events.size(); ++i) {
        const auto& e = win_events[i];
        if (e.op_type == SHIELD_OP_WRITE) {
            total_bytes += e.size;
            write_count++;
            write_sizes.push_back((double)e.size);
            entropies.push_back((double)e.entropy / 1000.0);
        } else {
            read_count++;
        }
        
        if (i > 0) {
            inter_arrival_times.push_back((double)(win_events[i].timestamp_ns - win_events[i-1].timestamp_ns) / NS_TO_SEC);
        }
    }
    
    // V7.0 Production Log-Transforms
    fv.features[FeatureVector::TOTAL_ACCESSES] = log1p_f((double)n);
    fv.features[FeatureVector::TOTAL_BYTES] = log1p_f(total_bytes);
    fv.features[FeatureVector::READ_COUNT] = log1p_f(read_count);
    fv.features[FeatureVector::WRITE_COUNT] = log1p_f(write_count);
    
    if (!write_sizes.empty()) {
        double sum = std::accumulate(write_sizes.begin(), write_sizes.end(), 0.0);
        double mean = sum / write_sizes.size();
        fv.features[FeatureVector::MEAN_ACCESS_SIZE] = mean;
        
        double std_dev = calculate_std_dev(write_sizes, mean);
        fv.features[FeatureVector::STD_ACCESS_SIZE] = std_dev;
        
        // Relative Standard Deviation (Uniformity Proxy)
        fv.features[FeatureVector::WRITE_SIZE_UNIFORMITY] = (mean > 0) ? (std_dev / mean) : 0.0;
    }

    /* 2. Entropy features */
    if (!entropies.empty()) {
        double sum_ent = std::accumulate(entropies.begin(), entropies.end(), 0.0);
        double mean_ent = sum_ent / entropies.size();
        fv.features[FeatureVector::MEAN_ENTROPY] = mean_ent;
        
        double std_dev_ent = calculate_std_dev(entropies, mean_ent);
        fv.features[FeatureVector::ENTROPY_VARIANCE_BLOCKS] = std_dev_ent * std_dev_ent;

        double high_count = 0, peak_count = 0;
        for (double val : entropies) {
            if (val > 0.85) high_count++;
            if (val > 0.95) peak_count++;
        }
        fv.features[FeatureVector::HIGH_ENTROPY_RATIO] = high_count / entropies.size();
        fv.features[FeatureVector::PEAK_ENTROPY_RATIO] = peak_count / entropies.size();

        /* Entropy Trend: last third vs first third */
        size_t third = entropies.size() / 3;
        if (third > 0) {
            double first_third_sum = std::accumulate(entropies.begin(), entropies.begin() + third, 0.0);
            double last_third_sum = std::accumulate(entropies.end() - third, entropies.end(), 0.0);
            fv.features[FeatureVector::ENTROPY_TREND] = (last_third_sum / third) - (first_third_sum / third);
        }
    }

    /* 3. Temporal features */
    double duration = (win_events.back().timestamp_ns - win_events.front().timestamp_ns) / NS_TO_SEC;
    if (duration <= 0) duration = 0.001; 
    
    fv.features[FeatureVector::ACCESS_RATE] = n / duration;
    
    if (!inter_arrival_times.empty()) {
        double sum_iat = std::accumulate(inter_arrival_times.begin(), inter_arrival_times.end(), 0.0);
        double mean_iat = sum_iat / inter_arrival_times.size();
        double std_iat = calculate_std_dev(inter_arrival_times, mean_iat);
        
        fv.features[FeatureVector::INTER_ACCESS_MEAN] = mean_iat;
        fv.features[FeatureVector::INTER_ACCESS_STD] = std_iat;
        
        // Coefficient of Variation (Burstiness)
        fv.features[FeatureVector::BURSTINESS] = (mean_iat > 0) ? (std_iat / mean_iat) : 0.0;
    }

    /* IO Accel (Trend Derivative) */
    uint64_t mid_ts = win_events.front().timestamp_ns + (uint64_t)((duration / 2.0) * NS_TO_SEC);
    int first_half_cnt = 0, second_half_cnt = 0;
    for(const auto& e : win_events) {
        if(e.timestamp_ns < mid_ts) first_half_cnt++;
        else second_half_cnt++;
    }
    double v1 = first_half_cnt / (duration / 2.0 + 0.001);
    double v2 = second_half_cnt / (duration / 2.0 + 0.001);
    fv.features[FeatureVector::IO_ACCELERATION] = (v2 - v1) / (duration / 2.0 + 0.001);

    /* 4. Spatial features */
    std::set<uint64_t> unique_blocks;
    std::vector<uint64_t> lbas;
    for (const auto &e : win_events) {
        unique_blocks.insert(e.addr);
        lbas.push_back(e.addr);
    }
    fv.features[FeatureVector::UNIQUE_BLOCKS] = (double)unique_blocks.size();
    if (!lbas.empty()) {
        auto [min_it, max_it] = std::minmax_element(lbas.begin(), lbas.end());
        fv.features[FeatureVector::BLOCK_RANGE] = (double)(*max_it - *min_it);
        
        std::sort(lbas.begin(), lbas.end());
        int seq_cnt = 0;
        for (size_t i = 1; i < lbas.size(); ++i) {
            if (lbas[i] - lbas[i-1] <= 8) seq_cnt++;
        }
        fv.features[FeatureVector::SEQUENTIAL_RATIO] = (double)seq_cnt / lbas.size();
    }

    /* Ratios and Cross-Group */
    fv.features[FeatureVector::READ_RATIO] = read_count / (double)n;
    fv.features[FeatureVector::WRITE_RATIO] = write_count / (double)n;
    fv.features[FeatureVector::RW_RATIO] = write_count > 0 ? read_count / write_count : 1.0;
    
    // Memory Entropy Proxy (refined with temporal variance)
    fv.features[FeatureVector::WRITE_ENTROPY_MEAN] = fv.features[FeatureVector::MEAN_ENTROPY];
    fv.features[FeatureVector::HIGH_ENTROPY_WRITE_RATIO] = fv.features[FeatureVector::HIGH_ENTROPY_RATIO];
    fv.features[FeatureVector::WRITE_ACCELERATION] = fv.features[FeatureVector::IO_ACCELERATION];

    return fv;
}
