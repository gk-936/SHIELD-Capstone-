#include <stdio.h>
#include <unistd.h>
#include <sys/resource.h>
#include <bpf/libbpf.h>
#include <bpf/bpf.h>
#include <signal.h>
#include "shield_sensors.skel.h"
#include "bpf/common.h"
#include "engine/feature_engine.hpp"
#include "dashboard_bridge.hpp"
#include "forensic_manager.hpp"
#include <sys/wait.h>
#include <iostream>
#include <limits.h>
#include <libgen.h>

namespace shield {
    extern DashboardBridge g_dashboard;
    extern void SetBpfSensorMaps(int suspend_fd, int throttle_fd);
    extern std::string GetSystemStatusJSON(uint64_t interval_ms);
}

// v7.2 - Real-time system monitoring
void* status_thread_func(void* arg) {
    while(true) {
        std::string status_json = shield::GetSystemStatusJSON(5000);
        shield::g_dashboard.PushUpdate(status_json);
        sleep(5);
    }
    return NULL;
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

    libbpf_set_print(libbpf_print_fn);

    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);

    skel = shield_sensors_bpf__open();
    if (!skel) {
        fprintf(stderr, "Failed to open BPF skeleton\n");
        return 1;
    }

    err = shield_sensors_bpf__load(skel);
    if (err) {
        fprintf(stderr, "Failed to load and verify BPF skeleton\n");
        goto cleanup;
    }

    err = shield_sensors_bpf__attach(skel);
    if (err) {
        fprintf(stderr, "Failed to attach BPF skeleton\n");
        goto cleanup;
    }

    // --- SELF-PID EXCLUSION (v7.2) ---
    // Tell the kernel sensors to ignore THIS process to avoid the self-monitoring loop
    {
        unsigned int self_pid = getpid();
        unsigned int val = 1;
        int self_map_fd = bpf_map__fd(skel->maps.self_pid_map);
        if (self_map_fd >= 0) {
            bpf_map_update_elem(self_map_fd, &self_pid, &val, BPF_ANY);
            printf("[🛡️] Registered Self-PID %u for Kernel Silence.\n", self_pid);
        }
    }

    printf("S.H.I.E.L.D Sensor Layer Loaded Successfully.\n");
    printf("Intercepting storage and memory events...\n");

    shield::g_dashboard.Start();

    // v8.0 - Initialize ForensicManager with absolute paths
    {
        // Resolve the repo root relative to the daemon binary location
        char exe_path[PATH_MAX] = {0};
        readlink("/proc/self/exe", exe_path, sizeof(exe_path) - 1);
        // binary is at: <repo>/backend/shield/shield_daemon
        // repo root is two levels up
        std::string daemon_dir = dirname(dirname(exe_path));
        std::string repo_root  = dirname(const_cast<char*>(daemon_dir.c_str()));
        // Use absolute paths resolved at runtime
        std::string sandbox = repo_root + "/scripts/shield_sandbox";
        std::string vault   = repo_root + "/scripts/.shield_vault";
        shield::ForensicManager::Get().Init(sandbox, vault);
        printf("[\xf0\x9f\x9b\xa1\xef\xb8\x8f] Forensic Vault: %s\n", vault.c_str());
        printf("[\xf0\x9f\x9b\xa1\xef\xb8\x8f] Protected Sandbox: %s\n", sandbox.c_str());
    }

    pthread_t tid;
    pthread_create(&tid, NULL, status_thread_func, NULL);

    shield::SetBpfSensorMaps(bpf_map__fd(skel->maps.suspend_map), bpf_map__fd(skel->maps.throttle_map));

    err = handle_ring_buffer(skel);

    if (err < 0) {
        fprintf(stderr, "Error polling ring buffer: %d\n", err);
        goto cleanup;
    }

cleanup:
    shield::g_dashboard.Stop();
    shield_sensors_bpf__destroy(skel);
    return err < 0 ? -err : 0;
}
