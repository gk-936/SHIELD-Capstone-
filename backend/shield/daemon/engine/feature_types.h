#ifndef __SHIELD_FEATURE_TYPES_H
#define __SHIELD_FEATURE_TYPES_H

#include <vector>
#include <string>
#include <stdint.h>

/**
 * Feature vector containing 32 behavioral metrics.
 */
struct FeatureVector {
    uint32_t pid;
    char comm[16];
    double features[32];
    
    /* Feature Index Map based on SHIELD Design Document */
    enum Index {
        /* Volume Group (0-3) */
        TOTAL_ACCESSES = 0,
        TOTAL_BYTES,
        MEAN_ACCESS_SIZE,
        STD_ACCESS_SIZE,
        
        /* Entropy Group (4-11) */
        MEAN_ENTROPY,
        STD_ENTROPY,
        HIGH_ENTROPY_RATIO,
        ENTROPY_SPIKE_COUNT,
        MAX_ENTROPY,
        ENTROPY_TREND,
        ENTROPY_VARIANCE_BLOCKS,
        PEAK_ENTROPY_RATIO,
        
        /* Temporal Group (12-17) */
        DURATION_SEC,
        ACCESS_RATE,
        INTER_ACCESS_MEAN,
        INTER_ACCESS_STD,
        BURSTINESS,
        IO_ACCELERATION,
        
        /* Spatial Group (18-20) */
        UNIQUE_BLOCKS,
        BLOCK_RANGE,
        SEQUENTIAL_RATIO,
        
        /* Memory Group (21-26) */
        WRITE_COUNT,
        WRITE_RATIO,
        RW_RATIO,
        WRITE_ENTROPY_MEAN,
        HIGH_ENTROPY_WRITE_RATIO,
        WRITE_ACCELERATION,
        
        /* Derived Group (27-31) */
        WRITE_SIZE_UNIFORMITY,
        ENTROPY_ACCESS_RATE_RATIO,
        ENTROPY_X_RATE,
        ENTROPY_RATE,
        WRITE_ENTROPY_VOLUME
    };
};

#endif /* __SHIELD_FEATURE_TYPES_H */
