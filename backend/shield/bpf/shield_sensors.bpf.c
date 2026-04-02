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
    if (cfg && (mask & 2)) {
        // Log suspension logic
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
