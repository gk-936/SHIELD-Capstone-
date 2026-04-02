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
    
    for (const auto &e : win_events) {
        if (e.op_type == SHIELD_OP_WRITE) {
            total_bytes += e.size;
            write_count++;
            write_sizes.push_back((double)e.size);
            entropies.push_back((double)e.entropy / 1000.0);
        } else {
            read_count++;
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
        
        double sq_sum = 0;
        for(double val : write_sizes) sq_sum += (val - mean) * (val - mean);
        fv.features[FeatureVector::STD_ACCESS_SIZE] = std::sqrt(sq_sum / write_sizes.size());
    }

    /* 2. Entropy features */
    if (!entropies.empty()) {
        double sum_ent = std::accumulate(entropies.begin(), entropies.end(), 0.0);
        double mean_ent = sum_ent / entropies.size();
        fv.features[FeatureVector::MEAN_ENTROPY] = mean_ent;
        
        double sq_sum_ent = 0;
        for(double val : entropies) sq_sum_ent += (val - mean_ent) * (val - mean_ent);

        double high_count = 0;
        double spike_count = 0;
        double peak_count = 0;
        for (double val : entropies) {
            if (val > 0.85) high_count++;
            if (val > 0.90) spike_count++;
            if (val > 0.95) peak_count++;
        }
        fv.features[FeatureVector::HIGH_ENTROPY_RATIO] = high_count / entropies.size();
        // Index update: PEAK_ENTROPY_RATIO=11
        fv.features[FeatureVector::PEAK_ENTROPY_RATIO] = peak_count / entropies.size();

        /* Entropy Trend: last third vs first third */
        size_t third = entropies.size() / 3;
        if (third > 0) {
            double first_third_sum = std::accumulate(entropies.begin(), entropies.begin() + third, 0.0);
            double last_third_sum = std::accumulate(entropies.end() - third, entropies.end(), 0.0);
            fv.features[FeatureVector::ENTROPY_TREND] = (last_third_sum / third) - (first_third_sum / third);
        }
        
        fv.features[FeatureVector::ENTROPY_VARIANCE_BLOCKS] = sq_sum_ent / entropies.size();
    }

    /* 3. Temporal features */
    double duration = (win_events.back().timestamp_ns - win_events.front().timestamp_ns) / NS_TO_SEC;
    if (duration <= 0) duration = 0.1;
    fv.features[FeatureVector::ACCESS_RATE] = n / duration;
    fv.features[FeatureVector::INTER_ACCESS_MEAN] = duration / (n + 1);
    fv.features[FeatureVector::INTER_ACCESS_STD] = 0.01; 
    fv.features[FeatureVector::BURSTINESS] = (n > 10) ? 0.8 : 0.2;

    /* IO Accel */
    uint64_t mid_ts = win_events.front().timestamp_ns + (uint64_t)((duration / 2.0) * NS_TO_SEC);
    int first_half_cnt = 0, second_half_cnt = 0;
    for(const auto& e : win_events) {
        if(e.timestamp_ns < mid_ts) first_half_cnt++;
        else second_half_cnt++;
    }
    fv.features[FeatureVector::IO_ACCELERATION] = (second_half_cnt - first_half_cnt) / (duration / 2.0 + 0.001);

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
    fv.features[FeatureVector::WRITE_SIZE_UNIFORMITY] = (fv.features[FeatureVector::STD_ACCESS_SIZE] < 1024) ? 1.0 : 0.0;
    fv.features[FeatureVector::READ_RATIO] = read_count / (n);
    fv.features[FeatureVector::WRITE_RATIO] = write_count / (n);
    fv.features[FeatureVector::RW_RATIO] = write_count > 0 ? read_count / write_count : 1.0;
    
    // Placeholder Memory Entropy (derived from storage entropy in this simulation)
    fv.features[FeatureVector::WRITE_ENTROPY_MEAN] = fv.features[FeatureVector::MEAN_ENTROPY];
    fv.features[FeatureVector::HIGH_ENTROPY_WRITE_RATIO] = fv.features[FeatureVector::HIGH_ENTROPY_RATIO];
    fv.features[FeatureVector::WRITE_ACCELERATION] = 0.0;

    return fv;
}
