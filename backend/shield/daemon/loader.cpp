#include <stdio.h>
#include <unistd.h>
#include <sys/resource.h>
#include <bpf/libbpf.h>
#include <signal.h>
#include "shield_sensors.skel.h"
#include "bpf/common.h"
#include "engine/feature_engine.hpp"
#include "dashboard_bridge.hpp"
#include <sys/wait.h>

namespace shield {
    extern DashboardBridge g_dashboard;
}

FeatureEngine g_engine;
extern "C" int handle_ring_buffer(struct shield_sensors_bpf *skel);

static pid_t g_dashboard_pid = -1;

void start_dashboard() {
    g_dashboard_pid = fork();
    if (g_dashboard_pid == 0) {
        // Child: Change directory to project root for correct config loading
        std::cout << "[🛡️] Launching S.H.I.E.L.D. Dashboard (Vite)..." << std::endl;
        
        // Move from backend/shield/ to project root (../..)
        if (chdir("../..") != 0) {
            std::cerr << "[🛡️] Failed to reach project root." << std::endl;
            exit(1);
        }

        // Launch standard Vite via npm (now finds root vite.config.js)
        execlp("npm", "npm", "run", "dev", "--", "--host", NULL);
        
        std::cerr << "[🛡️] Failed to start dashboard. Is npm installed?" << std::endl;
        exit(1);
    }
}

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

    /* Start Dashboard Bridge */
    shield::g_dashboard.Start();

    /* Start Dashboard Frontend */
    start_dashboard();

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
