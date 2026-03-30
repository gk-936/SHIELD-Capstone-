import type {
  ProcessInfo,
  Alert,
  eBPFEvent,
  EnforcementAction,
  DecisionLevel,
  IncidentReport,
  SystemHealthMetrics,
  RankObservation,
  SHAPExplanation,
  CouncilModelScores,
  TamperEvent,
  ScalerRecalibrationInfo,
} from '../types';

const PROCESS_NAMES = [
  'nginx', 'python3', 'node', 'mysqld', 'bash', 'cron', 'systemd',
  'sshd', 'docker', 'redis-server', 'postgres', 'java', 'ruby', 'apache2',
  'php-fpm', 'git', 'npm', 'wget', 'curl', 'openssl', 'cryptsetup',
];

const FEATURES = [
  'read_count', 'write_count', 'mean_entropy', 'high_entropy_ratio',
  'rw_ratio', 'entropy_trend', 'io_acceleration', 'write_entropy_volume',
  'unique_files_written', 'file_access_rate', 'large_file_writes',
  'rapid_file_ops', 'temp_file_writes', 'system_file_modification',
  'network_io_ratio', 'memory_growth_rate', 'cpu_duration',
  'thread_count_change', 'file_lock_attempts', 'file_delete_ratio',
  'rename_operation_count', 'entropy_concentration', 'disk_io_pattern',
  'file_type_diversity', 'synchronous_io_ratio', 'buffer_cache_misses',
  'page_fault_rate', 'brk_syscall_count', 'mmap_syscall_count',
  'entropy_spike_detection', 'parallelism_degree', 'i_o_per_sec',
  'total_bytes_written',
];

const SHAP_FEATURES = [
  'high_entropy_ratio', 'write_entropy_volume', 'rapid_file_ops',
  'file_delete_ratio', 'entropy_spike_detection', 'large_file_writes',
];

const MITRE_TECHNIQUES = [
  'T1565', // Data Destruction
  'T1490', // Inhibit System Recovery
  'T1486', // Data Encrypted for Impact
  'T1561', // Disk Wipe
  'T1529', // System Shutdown/Reboot
  'T1570', // Lateral Tool Transfer
  'T1570', // Lateral Tool Transfer
];

const RANSOMWARE_FAMILIES = [
  'LockBit', 'Conti', 'Nokoyawa', 'Alphv', 'BlackCat', 'Play', 'Cl0p',
];

// Generate random number between min and max
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Generate random integer between min and max
function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random element from array
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate realistic process info
export function generateProcessInfo(pid?: number, decisionLevel?: DecisionLevel): ProcessInfo {
  const actualPid = pid || randomIntBetween(1000, 65535);
  const decidedLevel = decisionLevel || randomElement(['BENIGN', 'SUSPICIOUS', 'MEDIUM', 'HIGH'] as const);
  const processName = randomElement(PROCESS_NAMES);
  
  const scoreRanges: Record<DecisionLevel, [number, number]> = {
    BENIGN: [0, 0.15],
    SUSPICIOUS: [0.15, 0.35],
    MEDIUM: [0.35, 0.59],
    HIGH: [0.59, 0.85],
    CONFIRMED: [0.85, 1.0],
  };

  const [minScore, maxScore] = scoreRanges[decidedLevel];
  const rankScore = randomBetween(minScore, maxScore);

  return {
    pid: actualPid,
    processName,
    executablePath: `/usr/bin/${processName}`,
    parentPid: randomIntBetween(1, 1000),
    parentName: randomElement(PROCESS_NAMES),
    startTime: Date.now() - randomBetween(60000, 3600000),
    currentCpu: randomBetween(0, 100),
    currentMemory: randomBetween(10, 1000),
    cgroupMembership: `/pods/pod-${randomIntBetween(100, 999)}`,
    rankScore,
    decisionLevel: decidedLevel,
    readCount: randomIntBetween(100, 10000),
    writeCount: randomIntBetween(100, 5000),
    meanEntropy: randomBetween(0, 8),
    highEntropyRatio: randomBetween(0, 1),
    rwRatio: randomBetween(0.1, 10),
    entropyTrend: randomBetween(-0.5, 0.5),
    ioAcceleration: randomBetween(0, 100),
    writeEntropyVolume: randomBetween(0, 10000),
    topSHAPFeature: randomElement(SHAP_FEATURES),
    topSHAPValue: randomBetween(-0.5, 0.5),
  };
}

// Generate rank history
export function generateRankHistory(length: number = 60): RankObservation[] {
  const now = Date.now();
  const observations: RankObservation[] = [];
  
  for (let i = 0; i < length; i++) {
    observations.push({
      timestamp: now - (length - i - 1) * 1000,
      score: randomBetween(0.1, 0.8),
      weightedScore: randomBetween(0.1, 0.8),
    });
  }
  
  return observations;
}

// Generate eBPF events
export function generateEBPFEvents(count: number = 100): eBPFEvent[] {
  const events: eBPFEvent[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    events.push({
      timestamp: now - randomIntBetween(0, 60000),
      operation: randomElement(['read', 'write', 'rename', 'unlink'] as const),
      lba: randomIntBetween(0, 1000000),
      gpa: randomIntBetween(0, 1000000),
      size: randomIntBetween(512, 1000000),
      entropy: randomBetween(0, 8),
      pid: randomIntBetween(1000, 65535),
    });
  }
  
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

// Generate enforcement actions
export function generateEnforcementActions(): EnforcementAction[] {
  const now = Date.now();
  
  return [
    {
      timestamp: now - 180000,
      action: 'throttle_applied',
      triggeringRankScore: 0.45,
      description: 'I/O throttling activated due to elevated entropy',
    },
    {
      timestamp: now - 120000,
      action: 'SIGSTOP',
      triggeringRankScore: 0.62,
      description: 'Process stopped - HIGH alert threshold exceeded',
    },
    {
      timestamp: now - 60000,
      action: 'throttle_released',
      triggeringRankScore: 0.38,
      description: 'Throttling released - entropy returned to normal',
    },
  ];
}

// Generate SHAP explanations
export function generateSHAPExplanations(): SHAPExplanation[] {
  return SHAP_FEATURES.map(feature => ({
    featureName: feature,
    shapValue: randomBetween(-0.5, 0.5),
    direction: Math.random() > 0.5 ? 'positive' : 'negative',
  }));
}

// Generate council model scores
export function generateCouncilScores(): CouncilModelScores {
  return {
    IF_storage: randomBetween(0, 1),
    IF_memory: randomBetween(0, 1),
    IF_full: randomBetween(0, 1),
    HBOS: randomBetween(0, 1),
    LOF: randomBetween(0, 1),
    IF_diverse: randomBetween(0, 1),
  };
}

// Generate alerts
export function generateAlerts(count: number = 15): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const timestamp = now - randomIntBetween(60000, 3600000);
    const duration = randomIntBetween(30000, 600000);
    const decisionLevel = randomElement(['MEDIUM', 'HIGH', 'CONFIRMED'] as const);
    
    alerts.push({
      alertId: `ALERT-${randomIntBetween(100000, 999999)}`,
      timestamp,
      pid: randomIntBetween(1000, 65535),
      processName: randomElement(PROCESS_NAMES),
      peakLevel: decisionLevel,
      peakScore: randomBetween(0.3, 0.95),
      duration,
      outcome: randomElement(['Killed', 'False Positive', 'Resolved', 'Active'] as const),
      reportAvailable: Math.random() > 0.3,
      latestScores: Array.from({ length: 6 }, () => randomBetween(0.2, 0.9)),
      isFalsePositive: Math.random() > 0.8,
    });
  }
  
  return alerts;
}

// Generate incident reports
export function generateIncidentReports(count: number = 5): IncidentReport[] {
  const reports: IncidentReport[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    reports.push({
      reportId: `RPT-${randomIntBetween(100000, 999999)}`,
      incidentId: `INC-${randomIntBetween(100000, 999999)}`,
      timestamp: now - randomIntBetween(3600000, 86400000),
      ransomwareFamily: randomElement(RANSOMWARE_FAMILIES),
      affectedPid: randomIntBetween(1000, 65535),
      severity: randomElement(['MEDIUM', 'HIGH', 'CONFIRMED'] as const),
      mitreTechniques: Array.from(
        { length: randomIntBetween(2, 5) },
        () => randomElement(MITRE_TECHNIQUES)
      ),
      htmlContent: generateReportHTML(),
      forensicArtifacts: [
        '/tmp/.malware_cache',
        '/var/log/suspicious.log',
        '~/.ssh/authorized_keys',
      ],
      responseActions: [
        'Terminated malicious process',
        'Isolated affected host',
        'Preserved forensic evidence',
      ],
      recommendedRemediation: [
        'Rotate all credentials',
        'Scan all connected systems',
        'Update security signatures',
      ],
    });
  }
  
  return reports;
}

// Generate HTML report content
function generateReportHTML(): string {
  return `
    <div class="report-content">
      <h2>Incident Report</h2>
      <h3>Executive Summary</h3>
      <p>A potential ransomware activity was detected on the monitored system.</p>
      
      <h3>Affected System Details</h3>
      <ul>
        <li>Hostname: production-db-01</li>
        <li>IP Address: 192.168.1.100</li>
        <li>Operating System: Linux</li>
      </ul>
      
      <h3>Detection Evidence</h3>
      <p>The S.H.I.E.L.D system detected elevated entropy patterns and rapid file encryption behavior.</p>
      
      <h3>Response Actions Taken</h3>
      <ul>
        <li>Process terminated</li>
        <li>System isolated from network</li>
        <li>Forensic data preserved</li>
      </ul>
    </div>
  `;
}

// Generate system health metrics
export function generateSystemHealthMetrics(): SystemHealthMetrics {
  return {
    ringBufferFillPercentage: randomBetween(10, 80),
    eventsPerSecond: randomBetween(100, 5000),
    eventsDropped: Math.random() > 0.9 ? randomIntBetween(1, 100) : 0,
    ebpfProgramStatus: {
      'probe_vfs_read': 'loaded',
      'probe_vfs_write': 'loaded',
      'probe_file_rename': 'loaded',
      'probe_file_unlink': 'loaded',
    },
    featureVectorsPerSecond: randomBetween(50, 500),
    meanLatencyEventToVector: randomBetween(1, 100),
    pidCountTracked: randomIntBetween(50, 1000),
    circularBufferMemory: randomIntBetween(100, 1000),
    inferencesPerSecond: randomBetween(10, 200),
    meanInferenceLatency: randomBetween(1, 20),
    councilModelStatus: {
      IF_storage: 'loaded',
      IF_memory: 'loaded',
      IF_full: 'loaded',
      HBOS: 'loaded',
      LOF: 'loaded',
      IF_diverse: 'loaded',
    },
    xgboostModelVersion: '2.0.1',
    xgboostLoadTime: randomBetween(50, 200),
    falsePosRate24h: randomBetween(0, 0.05),
    falseNegRate24h: randomBetween(0, 0.02),
    rollingAUC: randomBetween(0.95, 0.99),
    thresholds: {
      MEDIUM: 0.35,
      HIGH: 0.59,
      CRITICAL: 0.8,
    },
  };
}

// Generate tamper events
export function generateTamperEvents(): TamperEvent[] {
  const now = Date.now();
  return [
    {
      timestamp: now - 3600000,
      type: 'ebpf_program_unload_attempt',
      severity: 'high',
      description: 'Attempted to unload eBPF tracking program',
    },
    {
      timestamp: now - 1800000,
      type: 'log_deletion_attempt',
      severity: 'medium',
      description: 'Attempted to delete S.H.I.E.L.D logs',
    },
  ];
}

// Generate scaler recalibration info
export function generateScalerRecalibration(): ScalerRecalibrationInfo {
  const now = Date.now();
  return {
    lastRecalibration: now - 86400000,
    nextScheduled: now + 86400000,
    benignSamplesInBuffer: randomIntBetween(1000, 10000),
    driftMetric: randomBetween(0.01, 0.15),
  };
}

// Generate feature statistics
export function generateFeatureStats() {
  return FEATURES.map(name => ({
    name,
    currentValue: randomBetween(0, 100),
    minValue: randomBetween(0, 50),
    maxValue: randomBetween(50, 100),
    meanValue: randomBetween(20, 80),
    deviation: randomElement(['normal', 'elevated', 'critical'] as const),
  }));
}

// Generate related processes
export function generateRelatedProcesses(count: number = 5): ProcessInfo[] {
  return Array.from({ length: count }, () => generateProcessInfo());
}
