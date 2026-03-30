#ifndef __SHIELD_COMMON_H
#define __SHIELD_COMMON_H

#include <linux/types.h>

/* Operation Types */
enum op_type {
    OP_READ,
    OP_WRITE,
    OP_RENAME,
    OP_UNLINK,
    OP_OPEN,
    OP_MMAP,
    OP_PAGE_FAULT,
    OP_RANSOM_NOTE,
};

/* Event structure sent to userspace - 48 bytes approx */
struct event_t {
    __u32 pid;
    __u32 ppid;
    __u64 timestamp_ns;
    __u64 addr;         /* LBA for storage, GPA for memory */
    __u32 size;         /* Bytes written/read */
    __u32 entropy;      /* Shannon entropy (fixed-point: 0-1000 representing 0.0-1.0) */
    __u32 op_type;      /* enum op_type */
    char comm[16];      /* Process name */
};

/* Throttling config */
struct throttle_cfg {
    __u64 rate_limit_bps;
    __u64 current_window_start;
    __u64 bytes_in_current_window;
};

#endif /* __SHIELD_COMMON_H */
