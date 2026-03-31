#ifndef __SHIELD_COMMON_H
#define __SHIELD_COMMON_H

/* Operation Types - Prefixed to avoid global kernel namespace collisions */
enum op_type {
    SHIELD_OP_READ,
    SHIELD_OP_WRITE,
    SHIELD_OP_RENAME,
    SHIELD_OP_UNLINK,
    SHIELD_OP_OPEN,
    SHIELD_OP_MMAP,
    SHIELD_OP_PAGE_FAULT,
    SHIELD_OP_RANSOM_NOTE,
};

/* Event structure sent to userspace - 48 bytes approx */
struct event_t {
    unsigned int pid;        /* __u32 equivalent */
    unsigned int ppid;       /* __u32 equivalent */
    unsigned long long timestamp_ns; /* __u64 equivalent */
    unsigned long long addr; /* LBA for storage, GPA for memory */
    unsigned int size;       /* Bytes written/read */
    unsigned int entropy;    /* Shannon entropy (fixed-point: 0-1000) */
    unsigned int op_type;    /* enum op_type */
    char comm[16];           /* Process name */
};

/* Throttling config */
struct throttle_cfg {
    unsigned long long rate_limit_bps;
    unsigned long long current_window_start;
    unsigned long long bytes_in_current_window;
};

#endif /* __SHIELD_COMMON_H */
