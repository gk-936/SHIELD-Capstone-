#!/bin/bash

# SHIELD Ransomware Simulation Script
# This script performs high-entropy file encryption to test the AI detection engine.

TARGET_DIR="/tmp/shield_test_data"
mkdir -p "$TARGET_DIR"

echo "[💉] Preparing test data in $TARGET_DIR..."
for i in {1..50}; do
    dd if=/dev/urandom of="$TARGET_DIR/file_$i.dat" bs=1M count=1 2>/dev/null
done

echo "[🔥] Starting simulated ransomware attack (AES-256 encryption)..."
echo "[!] Watch the SHIELD daemon terminal for alerts!"

# Simulated attack loop: Encrypting files one by one
start_time=$(date +%s%N)
for file in "$TARGET_DIR"/*.dat; do
    openssl enc -aes-256-cbc -salt -in "$file" -out "$file.enc" -pass pass:shield_test 2>/dev/null
    rm "$file"
    # Small sleep to simulate realistic processing, but fast enough to trigger volume/entropy alerts
    sleep 0.1
done
end_time=$(date +%s%N)

duration=$(( (end_time - start_time) / 1000000 ))
echo "[✅] Simulation finished in $duration ms."
echo "[?] Check if the process 'openssl' was terminated by SHIELD."

# Cleanup
rm -rf "$TARGET_DIR"
