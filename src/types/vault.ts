export interface VaultSnapshot {
  key: string;          // Directory name e.g. "backup_12479" or "manual_1712345678"
  pid: number;
  processName: string;
  timestamp: number;    // Unix ms
  sizeBytes: number;
  level: 'HIGH' | 'MEDIUM' | 'MANUAL';
}

export interface VaultStatus {
  sandboxPath: string;
  vaultPath: string;
  totalSnapshots: number;
  totalSizeBytes: number;
  lastSnapshotTime: number | null;  // Unix ms or null if no snapshots
  snapshots: VaultSnapshot[];
  recentFiles: string[];            // Last 5 files added to any snapshot
}

export interface VaultOpResult {
  success: boolean;
  operation: 'restore' | 'delete' | 'snapshot' | 'clear';
  message: string;
}
