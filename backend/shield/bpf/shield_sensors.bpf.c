#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>
#include "common.h"

char LICENSE[] SEC("license") = "Dual BSD/GPL";

/* BPF Maps */

/* Ring buffer for event delivery to userspace */
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 64 * 1024 * 1024); /* 64MB */
} rb SEC(".maps");

/* PID -> Throttling configuration */
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 10240);
    __type(key, __u32);
    __type(value, struct throttle_cfg);
} throttle_map SEC(".maps");

/* PID -> Suspended flag */
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 10240);
    __type(key, __u32);
    __type(value, __u32);
} suspend_map SEC(".maps");

/* Per-CPU map for entropy histogram (256 buckets) */
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, 256);
    __type(key, __u32);
    __type(value, __u32);
} entropy_hist SEC(".maps");

/* Helper to log event to ringbuffer */
static __always_inline void log_event(__u32 pid, __u32 ppid, __u64 addr, __u32 size, __u32 entropy, enum op_type type) {
    struct event_t *e;

    e = bpf_ringbuf_reserve(&rb, sizeof(*e), 0);
    if (!e) return;

    e->pid = pid;
    e->ppid = ppid;
    e->timestamp_ns = bpf_ktime_get_ns();
    e->addr = addr;
    e->size = size;
    e->entropy = entropy;
    e->op_type = type;
    bpf_get_current_comm(&e->comm, sizeof(e->comm));

    bpf_ringbuf_submit(e, 0);
}

/* --- Storage Tracepoints --- */

SEC("tp/block/block_rq_issue")
int handle_block_issue(struct trace_event_raw_block_rq_issue *ctx) {
    __u32 pid = bpf_get_current_pid_tgid() >> 32;
    __u32 ppid = 0; // Simplified for BPF
    
    // In real implementation, we would extract LBA/sector from ctx
    // sector = BPF_CORE_READ(ctx, sector);
    // nr_sector = BPF_CORE_READ(ctx, nr_sector);
    
    log_event(pid, 0, 0, 0, 0, OP_READ); // Placeholder
    return 0;
}

/* --- Filesystem Tracepoints --- */

SEC("tp/syscalls/sys_enter_rename")
int handle_rename_enter(struct trace_event_raw_sys_enter *ctx) {
    __u32 pid = bpf_get_current_pid_tgid() >> 32;
    log_event(pid, 0, 0, 0, 0, OP_RENAME);
    return 0;
}

SEC("tp/syscalls/sys_enter_unlink")
int handle_unlink_enter(struct trace_event_raw_sys_enter *ctx) {
    __u32 pid = bpf_get_current_pid_tgid() >> 32;
    log_event(pid, 0, 0, 0, 0, OP_UNLINK);
    return 0;
}

/* --- LSM Throttling --- */

SEC("lsm/file_permission")
int BPF_PROG(shield_file_permission, struct file *file, int mask) {
    __u32 pid = bpf_get_current_pid_tgid() >> 32;

    struct throttle_cfg *cfg = bpf_map_lookup_elem(&throttle_map, &pid);
    if (cfg) {
        // Simple throttling logic: if bit 2 (write) is set
        if (mask & 2) {
             // Throttling logic would return -EPERM if rate exceeded
             // For now, allow but log
        }
    }

    __u32 *suspended = bpf_map_lookup_elem(&suspend_map, &pid);
    if (suspended) {
        return -1; // -EPERM equivalent
    }

    return 0;
}

/* --- Signal Gate --- */

SEC("lsm/task_kill")
int BPF_PROG(shield_task_kill, struct task_struct *p, struct kernel_siginfo *info, int sig, const struct cred *cred) {
    // Check if signal sender is authorized daemon
    // return -EPERM if unauthorized kill attempt detected
    return 0;
}
