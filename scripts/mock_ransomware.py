import os
import time
import random
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# --- CONFIGURATION (v7.1 HARDENING) ---
SANDBOX_DIR = "./shield_sandbox"
KEY = os.urandom(32)
IV = os.urandom(16)
FILE_COUNT = 500  # Increased for sliding window saturation

def encrypt_file(filepath):
    """Simulates real-world AES encryption that SHIELD sensors should catch at the Syscall layer."""
    with open(filepath, 'rb') as f:
        plaintext = f.read()
    
    cipher = Cipher(algorithms.AES(KEY), modes.CFB(IV), backend=default_backend())
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()
    
    # 2. Write-back (Captured by tp/syscalls/sys_enter_write)
    with open(filepath, 'wb') as f:
        f.write(ciphertext)
        f.flush()
        # Force kernel to acknowledge write (Hardware Sync)
        os.fsync(f.fileno()) 
    
    # 3. Rename (Captured by tp/syscalls/sys_enter_rename)
    new_path = filepath + ".encrypted"
    os.rename(filepath, new_path)

def run_simulation():
    if not os.path.exists(SANDBOX_DIR):
        print(f"❌ Error: Sandbox {SANDBOX_DIR} not found. Run sandbox_prep.py first.")
        return

    # Filter for un-encrypted files
    files = [os.path.join(SANDBOX_DIR, f) for f in os.listdir(SANDBOX_DIR) if not f.endswith(".encrypted")]
    
    # Sort to ensure predictable traversal
    files.sort()
    
    print(f"🕵️  Mock Ransomware (v7.1 Hardened Stress Test) starting on {len(files)} files...")
    print(f"⚙️  Sensor Mode: Syscall (Write >= 1KB) with Hardware Sync.")
    print(f"⚠️  TARGET: {os.path.abspath(SANDBOX_DIR)}")
    
    count = 0
    start_time = time.time()
    
    for f in files:
        try:
            encrypt_file(f)
            count += 1
            
            # 0.2s sleep is the "Heartbeat" shift the AI should detect as ACCELERATION
            # This ensures we don't finish too fast for the 60s window
            time.sleep(0.2) 
            
            if count % 10 == 0:
                elapsed = time.time() - start_time
                print(f"   [Processing...] {count}/{len(files)} files encrypted. T+{elapsed:.1f}s")
                
        except Exception as e:
            print(f"\n[🛡️] ATTACK NEUTRALIZED BY S.H.I.E.L.D. at file {count}.")
            print(f"   Details: {e}")
            break 
            
    print(f"\n✅ Simulation finished. Total Encrypted: {count}/{len(files)}")
    if count == len(files):
        print("🚩 WARNING: S.H.I.E.L.D. failed to stop the attack. Check Sensor and Brain logs.")
    else:
        print(f"🎯 SUCCESS: S.H.I.E.L.D. blocked the attack after {count} files.")

if __name__ == "__main__":
    run_simulation()
