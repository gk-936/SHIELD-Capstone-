import os
import random
import string
import time
import sys
import traceback

SANDBOX_DIR = "./shield_sandbox"
FILE_COUNT = 100
FILE_SIZE_KB = 64  # Larger files to ensure enough I/O events per process

def get_available_memory():
    """Get available memory in MB."""
    try:
        with open('/proc/meminfo', 'r') as f:
            for line in f:
                if line.startswith('MemAvailable:'):
                    return int(line.split()[1]) / 1024
    except:
        pass
    return None

def prep_sandbox():
    print(f"🏗️  Preparing S.H.I.E.L.D. Sandbox in {SANDBOX_DIR}...")
    
    # Check available memory before starting
    available_mem = get_available_memory()
    if available_mem is not None:
        print(f"📊 Available memory: {available_mem:.1f} MB")
    
    if not os.path.exists(SANDBOX_DIR):
        try:
            os.makedirs(SANDBOX_DIR)
            print(f"✅ Created directory: {SANDBOX_DIR}")
        except Exception as e:
            print(f"❌ Failed to create directory {SANDBOX_DIR}: {e}")
            sys.exit(1)
    
    for i in range(FILE_COUNT):
        try:
            filename = f"document_{i:03d}.txt"
            filepath = os.path.join(SANDBOX_DIR, filename)
            
            # Create a benign text file in small chunks to avoid memory issues
            # Use a simpler approach: pre-generate smaller chunks
            with open(filepath, "w") as f:
                # Write FILE_SIZE_KB chunks of 1KB each
                for chunk_idx in range(FILE_SIZE_KB):
                    # Generate random text (simpler method to avoid memory buildup)
                    chunk = "".join(random.choice(string.ascii_letters + " ") for _ in range(1024))
                    f.write(chunk)
            
            # Progress indicator every 10 files
            if (i + 1) % 10 == 0:
                print(f"  📝 Created {i + 1}/{FILE_COUNT} files", end="\r")
                sys.stdout.flush()
                
                # Check memory periodically
                if available_mem is not None:
                    current_mem = get_available_memory()
                    if current_mem and current_mem < 100:  # Less than 100MB available
                        print(f"\n⚠️  Warning: Low memory available ({current_mem:.1f} MB)")
        
        except MemoryError:
            print(f"\n❌ MemoryError at file {i}: Not enough memory to continue!")
            sys.exit(1)
        except OSError as e:
            print(f"\n❌ OSError at file {i}: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ Unexpected error at file {i}: {e}")
            traceback.print_exc()
            sys.exit(1)
    
    print(f"\n✅ Created {FILE_COUNT} files in sandbox.")

if __name__ == "__main__":
    try:
        prep_sandbox()
    except KeyboardInterrupt:
        print("\n⚠️  Process interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        traceback.print_exc()
        sys.exit(1)
