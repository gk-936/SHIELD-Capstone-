#include "feature_engine.hpp"
#include <cstring>
#include <algorithm>
#include <numeric>
#include <cmath>
#include <map>
#include <set>

#define NS_TO_SEC 1e9

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
    std::vector<double> write_sizes;
    std::vector<double> entropies;
    
    for (const auto &e : win_events) {
        if (e.op_type == SHIELD_OP_WRITE) {
            total_bytes += e.size;
            write_sizes.push_back((double)e.size);
            entropies.push_back((double)e.entropy / 1000.0);
        }
    }
    
    fv.features[FeatureVector::TOTAL_ACCESSES] = (double)n;
    fv.features[FeatureVector::TOTAL_BYTES] = total_bytes;
    
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
        
        double high_count = 0;
        double spike_count = 0;
        double peak_count = 0;
        double max_ent = 0;
        for (double val : entropies) {
            if (val > 0.85) high_count++;
            if (val > 0.90) spike_count++;
            if (val > 0.95) peak_count++;
            if (val > max_ent) max_ent = val;
        }
        fv.features[FeatureVector::HIGH_ENTROPY_RATIO] = high_count / entropies.size();
        fv.features[FeatureVector::ENTROPY_SPIKE_COUNT] = spike_count;
        fv.features[FeatureVector::MAX_ENTROPY] = max_ent;
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
    fv.features[FeatureVector::DURATION_SEC] = duration > 0 ? duration : 0.1;
    fv.features[FeatureVector::ACCESS_RATE] = n / fv.features[FeatureVector::DURATION_SEC];

    /* IO Accel: second half rate - first half rate */
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

    /* 5. Memory attributes */
    double mem_writes = 0, mem_reads = 0;
    for(const auto& e : win_events) {
        if(e.op_type == SHIELD_OP_WRITE) mem_writes++;
        if(e.op_type == SHIELD_OP_READ) mem_reads++;
    }
    fv.features[FeatureVector::WRITE_COUNT] = mem_writes;
    fv.features[FeatureVector::WRITE_RATIO] = mem_writes / (n);
    fv.features[FeatureVector::RW_RATIO] = mem_writes > 0 ? mem_reads / mem_writes : 1.0;

    return fv;
}
