import os
import random
import string
import sys

SANDBOX_DIR = "./shield_sandbox"
FILE_COUNT = 100
FILE_SIZE_KB = 64  # Larger files to ensure enough I/O events per process

def prep_sandbox():
    print(f"🏗️  Preparing S.H.I.E.L.D. Sandbox in {SANDBOX_DIR}...")
    
    if not os.path.exists(SANDBOX_DIR):
        try:
            os.makedirs(SANDBOX_DIR)
            print(f"✅ Created directory: {SANDBOX_DIR}")
        except Exception as e:
            print(f"❌ Failed to create directory: {e}")
            sys.exit(1)
    
    # Pre-generate a reusable character set to avoid excess memory allocation
    chars = string.ascii_letters + " "
    
    for i in range(FILE_COUNT):
        try:
            filename = f"document_{i:03d}.txt"
            filepath = os.path.join(SANDBOX_DIR, filename)
            
            # Create file in smaller, more memory-efficient chunks
            # Instead of building large strings in memory, write incrementally
            with open(filepath, "w") as f:
                for chunk_idx in range(FILE_SIZE_KB):
                    # Generate 1KB chunk using generator expression (memory efficient)
                    chunk = "".join(random.choice(chars) for _ in range(1024))
                    f.write(chunk)
            
            # Show progress every 10 files
            if (i + 1) % 10 == 0:
                print(f"  📝 Created {i + 1}/{FILE_COUNT} files...")
                sys.stdout.flush()
        
        except MemoryError as e:
            print(f"\n❌ MemoryError at file {i}: Not enough memory!")
            print(f"   Consider reducing FILE_SIZE_KB or FILE_COUNT.")
            sys.exit(1)
        except OSError as e:
            print(f"\n❌ OS Error at file {i}: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ Unexpected error at file {i}: {e}")
            sys.exit(1)
    
    print(f"✅ Created {FILE_COUNT} files in sandbox ({FILE_COUNT * FILE_SIZE_KB} KB total).")

if __name__ == "__main__":
    try:
        prep_sandbox()
    except KeyboardInterrupt:
        print("\n⚠️  Process interrupted")
        sys.exit(130)
