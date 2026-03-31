CLANG ?= clang
BPFTOOL ?= bpftool

ARCH := $(shell uname -m | sed 's/x86_64/x86/')
BPF_OBJ := bpf/shield_sensors.bpf.o
BPF_SKEL := daemon/shield_sensors.skel.h
ENGINE_SRC := daemon/engine/feature_engine.cpp daemon/engine/feature_calculator.cpp daemon/engine/inference_council.cpp
DAEMON_SRC := daemon/loader.cpp daemon/ring_buffer_consumer.cpp $(ENGINE_SRC)
DAEMON_EXE := shield_daemon

INCLUDES := -I/usr/include/$(shell uname -m)-linux-gnu -I. -Idaemon/engine

all: $(DAEMON_EXE)

# Generate vmlinux.h from running kernel
vmlinux.h:
	$(BPFTOOL) btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h

# Compile BPF C code
$(BPF_OBJ): bpf/shield_sensors.bpf.c bpf/common.h vmlinux.h
	$(CLANG) -g -O2 -target bpf -D__TARGET_ARCH_$(ARCH) $(INCLUDES) -c $< -o $@

# Generate BPF skeleton for userspace
$(BPF_SKEL): $(BPF_OBJ)
	$(BPFTOOL) gen skeleton $< > $@

# Compile Userspace Daemon
$(DAEMON_EXE): $(DAEMON_SRC) $(BPF_SKEL)
	$(CLANG) -g -O2 -Wall $(INCLUDES) $(DAEMON_SRC) -lbpf -lelf -lz -o $@

clean:
	rm -f $(BPF_OBJ) $(BPF_SKEL) $(DAEMON_EXE) vmlinux.h

.PHONY: all clean
