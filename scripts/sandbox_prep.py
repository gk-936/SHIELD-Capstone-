import os
import random
import string
import time

SANDBOX_DIR = "./shield_sandbox"
FILE_COUNT = 100
FILE_SIZE_KB = 64 # Larger files to ensure enough I/O events per process

def prep_sandbox():
    print(f"🏗️  Preparing S.H.I.E.L.D. Sandbox in {SANDBOX_DIR}...")
    if not os.path.exists(SANDBOX_DIR):
        os.makedirs(SANDBOX_DIR)
    
    for i in range(FILE_COUNT):
        filename = f"document_{i:03d}.txt"
        filepath = os.path.join(SANDBOX_DIR, filename)
        
        # Create a benign text file in small chunks to avoid OOM on low-memory systems
        with open(filepath, "w") as f:
            for _ in range(FILE_SIZE_KB):
                chunk = "".join(random.choices(string.ascii_letters + " ", k=1024))
                f.write(chunk)
    
    print(f"✅ Created {FILE_COUNT} files in sandbox.")

if __name__ == "__main__":
    prep_sandbox()
