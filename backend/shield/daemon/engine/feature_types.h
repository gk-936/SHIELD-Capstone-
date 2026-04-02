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
    double features[27];
    
    /* Feature Index Map: S.H.I.E.L.D. v7.0 Production Layout */
    enum Index {
        /* Storage Specialists (0-19) */
        TOTAL_ACCESSES = 0,
        MEAN_ACCESS_SIZE,
        STD_ACCESS_SIZE,
        MEAN_ENTROPY,
        HIGH_ENTROPY_RATIO,
        IO_ACCELERATION,
        BURSTINESS,
        UNIQUE_BLOCKS,
        BLOCK_RANGE,
        ENTROPY_TREND,
        ENTROPY_VARIANCE_BLOCKS,
        PEAK_ENTROPY_RATIO,
        ACCESS_RATE,
        INTER_ACCESS_MEAN,
        INTER_ACCESS_STD,
        SEQUENTIAL_RATIO,
        WRITE_SIZE_UNIFORMITY,
        TOTAL_BYTES,
        READ_COUNT,
        READ_RATIO,

        /* Memory Specialists (20-25) */
        WRITE_COUNT,
        WRITE_RATIO,
        RW_RATIO,
        WRITE_ENTROPY_MEAN,
        HIGH_ENTROPY_WRITE_RATIO,
        WRITE_ACCELERATION
    };
    
    static const int FEATURE_COUNT = 26;

};

#endif /* __SHIELD_FEATURE_TYPES_H */
