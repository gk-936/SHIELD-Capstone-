import joblib
import struct
import sys
import os

def export_scaler(pkl_path, out_path):
    if not os.path.exists(pkl_path):
        print(f"Error: {pkl_path} not found.")
        return

    data = joblib.load(pkl_path)
    
    # We expect 'scaler_storage' and 'scaler_memory' from the notebook
    # or a single 'scaler' if optimized.
    # The doc says 32 features. Let's assume we have them combined in 'scaler_storage'.
    # For now, let's extract 'center' (median) and 'scale' (IQR).
    
    scaler_s = data.get('scaler_storage')
    scaler_m = data.get('scaler_memory')
    
    if not scaler_s:
        print("Error: scaler_storage not found in pkl.")
        return

    # Pack as binary: [uint32 count] [float64[] medians] [float64[] iqrs]
    # We combine them if they are split.
    medians = list(scaler_s.center_)
    iqrs = list(scaler_s.scale_)
    
    if scaler_m:
        medians.extend(list(scaler_m.center_))
        iqrs.extend(list(scaler_m.scale_))

    count = len(medians)
    print(f"Exporting {count} feature scaling parameters...")

    with open(out_path, 'wb') as f:
        f.write(struct.pack('I', count))
        for val in medians:
            f.write(struct.pack('d', val))
        for val in iqrs:
            f.write(struct.pack('d', val))
    
    print(f"Succeeded! Saved to {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python export_scaler.py <input.pkl> <output.bin>")
    else:
        export_scaler(sys.argv[1], sys.argv[2])
