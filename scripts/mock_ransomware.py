import os
import time
import random
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# --- CONFIGURATION (SAFETY FIRST) ---
SANDBOX_DIR = "./shield_sandbox"
KEY = os.urandom(32)
IV = os.urandom(16)

def encrypt_file(filepath):
    """Simulates real-world AES encryption that ShIELD sensors should detect."""
    with open(filepath, 'rb') as f:
        plaintext = f.read()
    
    # 1. High Entropy Transformation
    cipher = Cipher(algorithms.AES(KEY), modes.CFB(IV), backend=default_backend())
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()
    
    # 2. Write-back (High Entropy Write)
    with open(filepath, 'wb') as f:
        f.write(ciphertext)
    
    # 3. Rename (Common Tactic)
    new_path = filepath + ".encrypted"
    os.rename(filepath, new_path)

def run_simulation():
    if not os.path.exists(SANDBOX_DIR):
        print(f"❌ Error: Sandbox {SANDBOX_DIR} not found. Run sandbox_prep.py first.")
        return

    files = [os.path.join(SANDBOX_DIR, f) for f in os.listdir(SANDBOX_DIR) if not f.endswith(".encrypted")]
    print(f"🕵️  Mock Ransomware (v7.0 Stress Test) starting on {len(files)} files...")
    print(f"⚠️  TARGET: {os.path.abspath(SANDBOX_DIR)}")
    
    count = 0
    for f in files:
        try:
            encrypt_file(f)
            count += 1
            
            # Mimic Bursty I/O pattern
            if count % 5 == 0:
                print(f"   [Processing...] {count}/{len(files)} files encrypted.")
                time.sleep(0.5) # The "Heartbeat" shift the AI should detect as ACCELERATION
                
        except Exception as e:
            print(f"   Error encrypting {f}: {e}")
            break # Stop simulation if process is killed or throttled
            
    print(f"✅ Simulation finished. Encrypted {count} files.")

if __name__ == "__main__":
    run_simulation()
