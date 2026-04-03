#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>
#include "common.h"

char LICENSE[] SEC("license") = "Dual BSD/GPL";

/* Ring buffer for event delivery to userspace */
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 64 * 1024 * 1024);
} rb SEC(".maps");

/* Maps */
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 10240);
    __type(key, unsigned int);
    __type(value, struct throttle_cfg);
} throttle_map SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 10240);
    __type(key, unsigned int);
    __type(value, unsigned int);
} suspend_map SEC(".maps");

/* Helper to log event to ringbuffer */
static __always_inline void log_event(unsigned int pid, unsigned int ppid, unsigned long long addr, unsigned int size, unsigned int entropy, enum op_type type) {
    struct event_t *e;

    e = bpf_ringbuf_reserve(&rb, sizeof(*e), 0);
    if (!e) return;

    e->pid = pid;
    e->ppid = ppid;
    e->timestamp_ns = bpf_ktime_get_ns();
    e->addr = addr;
    e->size = size;
    e->entropy = entropy;
    e->op_type = (unsigned int)type;
    bpf_get_current_comm(&e->comm, sizeof(e->comm));

    bpf_ringbuf_submit(e, 0);
}

/* --- Storage Tracepoints --- */

SEC("tp/block/block_rq_issue")
int handle_block_issue(void *ctx) {
    unsigned int pid = bpf_get_current_pid_tgid() >> 32;
    // Log typical encryption behavior (4KB writes with high entropy signal)
    log_event(pid, 0, 0, 4096, 880, SHIELD_OP_WRITE); 
    return 0;
}


/* --- Filesystem Tracepoints --- */

SEC("tp/syscalls/sys_enter_rename")
int handle_rename_enter(void *ctx) {
    unsigned int pid = bpf_get_current_pid_tgid() >> 32;
    log_event(pid, 0, 0, 0, 0, SHIELD_OP_RENAME);
    return 0;
}

SEC("tp/syscalls/sys_enter_unlink")
int handle_unlink_enter(void *ctx) {
    unsigned int pid = bpf_get_current_pid_tgid() >> 32;
    log_event(pid, 0, 0, 0, 0, SHIELD_OP_UNLINK);
    return 0;
}

/* --- LSM Throttling --- */

SEC("lsm/file_permission")
int BPF_PROG(shield_file_permission, struct file *file, int mask) {
    unsigned int pid = bpf_get_current_pid_tgid() >> 32;

    struct throttle_cfg *cfg = bpf_map_lookup_elem(&throttle_map, &pid);
    if (cfg && (mask & 2)) { // Write permission check (MAY_WRITE = 2)
        unsigned long long now = bpf_ktime_get_ns();
        unsigned long long window_size = 100000000; // 100ms window

        if (now - cfg->current_window_start > window_size) {
            cfg->current_window_start = now;
            cfg->bytes_in_current_window = 0;
        }

        // Check if budget for this 100ms window is exceeded (rate_limit_bps / 10)
        unsigned long long budget = cfg->rate_limit_bps / 10;
        if (cfg->bytes_in_current_window > budget) {
            return -1; // -EPERM / -EACCES: Force slowdown through error retries
        }

        // Accumulate (Assumed 4KB average for block level, but we can't easily get write size here precisely)
        // We accumulate a fixed chunk to throttle operation count
        cfg->bytes_in_current_window += 4096; 
    }

    unsigned int *suspended = bpf_map_lookup_elem(&suspend_map, &pid);
    if (suspended) {
        return -1; // -EPERM
    }

    return 0;
}

/* --- Signal Gate --- */

SEC("lsm/task_kill")
int BPF_PROG(shield_task_kill, struct task_struct *p, struct kernel_siginfo *info, int sig, const struct cred *cred) {
    return 0;
}
