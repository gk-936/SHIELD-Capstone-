// Decision levels for threat classification
export type DecisionLevel = 'BENIGN' | 'SUSPICIOUS' | 'MEDIUM' | 'HIGH' | 'CONFIRMED';

// Decision level colors for UI consistency
export const DECISION_COLORS: Record<DecisionLevel, string> = {
  BENIGN: '#22c55e',
  SUSPICIOUS: '#eab308',
  MEDIUM: '#f97316',
  HIGH: '#ef4444',
  CONFIRMED: '#991b1b',
};

export const DECISION_BG_COLORS: Record<DecisionLevel, string> = {
  BENIGN: 'bg-green-500/20',
  SUSPICIOUS: 'bg-yellow-500/20',
  MEDIUM: 'bg-orange-500/20',
  HIGH: 'bg-red-500/20',
  CONFIRMED: 'bg-red-800/20',
};

export const DECISION_TEXT_COLORS: Record<DecisionLevel, string> = {
  BENIGN: 'text-green-500',
  SUSPICIOUS: 'text-yellow-500',
  MEDIUM: 'text-orange-500',
  HIGH: 'text-red-500',
  CONFIRMED: 'text-red-700',
};

export const DECISION_BORDER_COLORS: Record<DecisionLevel, string> = {
  BENIGN: 'border-green-500/40',
  SUSPICIOUS: 'border-yellow-500/40',
  MEDIUM: 'border-orange-500/40',
  HIGH: 'border-red-500/40',
  CONFIRMED: 'border-red-800/60',
};

// Process information
export interface ProcessInfo {
  pid: number;
  processName: string;
  executablePath: string;
  parentPid?: number;
  parentName?: string;
  startTime: number;
  currentCpu: number;
  currentMemory: number;
  cgroupMembership: string;
  rankScore: number;
  decisionLevel: DecisionLevel;
  readCount: number;
  writeCount: number;
  meanEntropy: number;
  highEntropyRatio: number;
  rwRatio: number;
  entropyTrend: number;
  ioAcceleration: number;
  writeEntropyVolume: number;
  topSHAPFeature: string;
  topSHAPValue: number;
  
  /* Hardened forensic data */
  features?: number[];
  radarScores?: number[];
}

// Feature vector with 32 features
export interface FeatureVector {
  [key: string]: number;
}

// Feature with statistics
export interface FeatureStats {
  name: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  meanValue: number;
  deviation: 'normal' | 'elevated' | 'critical';
}

// SHAP explanation
export interface SHAPExplanation {
  featureName: string;
  shapValue: number;
  direction: 'positive' | 'negative'; // positive = ransomware, negative = benign
}

// Council model scores
export interface CouncilModelScores {
  IF_storage: number;
  IF_memory: number;
  IF_full: number;
  HBOS: number;
  LOF: number;
  IF_diverse: number;
}

// eBPF event
export interface eBPFEvent {
  timestamp: number;
  operation: 'read' | 'write' | 'rename' | 'unlink';
  lba: number;
  gpa: number;
  size: number;
  entropy: number;
  pid: number;
}

// Enforcement action
export interface EnforcementAction {
  timestamp: number;
  action: 'throttle_applied' | 'throttle_released' | 'SIGSTOP' | 'SIGCONT' | 'SIGKILL';
  triggeringRankScore: number;
  description: string;
}

// Alert information
export interface Alert {
  alertId: string;
  timestamp: number;
  pid: number;
  processName: string;
  peakLevel: DecisionLevel;
  peakScore: number;
  duration: number; // milliseconds
  outcome: 'Killed' | 'False Positive' | 'Resolved' | 'Active';
  reportAvailable: boolean;
  latestScores: number[];
  isFalsePositive?: boolean;
}

// Incident report
export interface IncidentReport {
  reportId: string;
  incidentId: string;
  timestamp: number;
  ransomwareFamily?: string;
  affectedPid: number;
  severity: DecisionLevel;
  mitreTechniques: string[];
  htmlContent: string;
  forensicArtifacts: string[];
  responseActions: string[];
  recommendedRemediation: string[];
}

// System health metrics
export interface SystemHealthMetrics {
  ringBufferFillPercentage: number;
  eventsPerSecond: number;
  eventsDropped: number;
  ebpfProgramStatus: Record<string, 'loaded' | 'error'>;
  featureVectorsPerSecond: number;
  meanLatencyEventToVector: number;
  pidCountTracked: number;
  circularBufferMemory: number;
  inferencesPerSecond: number;
  meanInferenceLatency: number;
  councilModelStatus: Record<string, 'loaded' | 'error'>;
  xgboostModelVersion: string;
  xgboostLoadTime: number;
  falsePosRate24h: number;
  falseNegRate24h: number;
  rollingAUC: number;
  thresholds: {
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
}

// Sliding window rank observation
export interface RankObservation {
  timestamp: number;
  score: number;
  weightedScore?: number;
}

// Tamper detection event
export interface TamperEvent {
  timestamp: number;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// Scaler recalibration info
export interface ScalerRecalibrationInfo {
  lastRecalibration: number;
  nextScheduled: number;
  benignSamplesInBuffer: number;
  driftMetric: number;
}

// WebSocket connection status
export interface ConnectionStatus {
  connected: boolean;
  lastHeartbeat: number;
}

// Rank history point
export interface RankHistoryPoint {
  timestamp: number;
  score: number;
  pid: number;
  processName: string;
}

// I/O operation type
export type IOOperation = 'read' | 'write' | 'rename' | 'unlink' | 'create' | 'delete';

// Comprehensive process detail
export interface ProcessDetail {
  process: ProcessInfo;
  rankHistory: RankObservation[];
  features: FeatureStats[];
  shapExplanations: SHAPExplanation[];
  councilScores: CouncilModelScores;
  ebpfEvents: eBPFEvent[];
  enforcementHistory: EnforcementAction[];
  relatedProcesses: ProcessInfo[];
}

// Global state for the application
export interface AppState {
  currentPage: 'overview' | 'process-detail' | 'alert-history' | 'reports' | 'system-health';
  selectedProcessPid?: number;
  processes: ProcessInfo[];
  alerts: Alert[];
  systemHealth: SystemHealthMetrics;
  connectionStatus: ConnectionStatus;
  processDetail?: ProcessDetail;
  reportsData: IncidentReport[];
  tamperLog: TamperEvent[];
  scalerRecalibration: ScalerRecalibrationInfo;
}

// Chart data point
export interface ChartPoint {
  time: number;
  value: number;
  label?: string;
}
