#include <stdio.h>
#include <unistd.h>
#include <bpf/libbpf.h>
#include "shield_sensors.skel.h"
#include "bpf/common.h"
#include "engine/feature_engine.hpp"

extern FeatureEngine g_engine;

/* Callback for ring buffer events */
static int handle_event(void *ctx, void *data, size_t data_sz) {
    const struct event_t *e = (const struct event_t *)data;

    if (data_sz < sizeof(*e)) {
        printf("Error: Truncated event data\n");
        return 0;
    }

    /* Push to Feature Engineering Engine */
    g_engine.push_event(*e);

    return 0;
}

extern bool exiting; // From loader.cpp

int handle_ring_buffer(struct shield_sensors_bpf *skel) {
    struct ring_buffer *rb = NULL;
    int err;

    /* Set up ring buffer poller */
    rb = ring_buffer__new(bpf_map__fd(skel->maps.rb), handle_event, NULL, NULL);
    if (!rb) {
        fprintf(stderr, "Failed to create ring buffer\n");
        return -1;
    }

    /* Polling loop */
    while (!exiting) {
        err = ring_buffer__poll(rb, 100 /* ms timeout */);
        
        /* Periodically check for completed feature windows */
        auto ready_windows = g_engine.get_ready_windows();
        for (const auto& fv : ready_windows) {
            printf("[FEATURE] PID: %d | COMM: %s | AccessRate: %.2f | MeanEntropy: %.2f\n", 
                   fv.pid, fv.comm, fv.features[FeatureVector::ACCESS_RATE], fv.features[FeatureVector::MEAN_ENTROPY]);
            // Module 3 will consume fv here
        }

        if (err == -EINTR) {
            err = 0;
            break;
        }
        if (err < 0) {
            printf("Error polling ring buffer: %d\n", err);
            break;
        }
    }

    ring_buffer__free(rb);
    return err;
}
