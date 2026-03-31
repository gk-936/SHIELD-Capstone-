#include <stdio.h>
#include <unistd.h>
#include <sys/resource.h>
#include <bpf/libbpf.h>
#include <signal.h>
#include "shield_sensors.skel.h"
#include "bpf/common.h"
#include "engine/feature_engine.hpp"

FeatureEngine g_engine; // Global engine instance

static volatile bool exiting = false;

static void sig_handler(int sig) {
    exiting = true;
}

static int libbpf_print_fn(enum libbpf_print_level level, const char *format, va_list args) {
    return vfprintf(stderr, format, args);
}

extern "C" int handle_ring_buffer(struct shield_sensors_bpf *skel);

int main(int argc, char **argv) {
    struct shield_sensors_bpf *skel;
    int err;

    /* Set up libbpf errors and debug info callback */
    libbpf_set_print(libbpf_print_fn);

    /* Cleaner handling of Ctrl-C */
    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);

    /* Open BPF application */
    skel = shield_sensors_bpf__open();
    if (!skel) {
        fprintf(stderr, "Failed to open BPF skeleton\n");
        return 1;
    }

    /* Load & verify BPF programs */
    err = shield_sensors_bpf__load(skel);
    if (err) {
        fprintf(stderr, "Failed to load and verify BPF skeleton\n");
        goto cleanup;
    }

    /* Attach tracepoints and LSM hooks */
    err = shield_sensors_bpf__attach(skel);
    if (err) {
        fprintf(stderr, "Failed to attach BPF skeleton\n");
        goto cleanup;
    }

    printf("S.H.I.E.L.D Sensor Layer Loaded Successfully.\n");
    printf("Intercepting storage and memory events...\n");

    /* Initialize Ring Buffer Consumption */
    err = handle_ring_buffer(skel);
    if (err < 0) {
        fprintf(stderr, "Error polling ring buffer: %d\n", err);
        goto cleanup;
    }

cleanup:
    shield_sensors_bpf__destroy(skel);
    return err < 0 ? -err : 0;
}
