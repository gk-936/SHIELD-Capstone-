import { create } from 'zustand';
import type { AppState, ProcessInfo, Alert, ConnectionStatus, SystemHealthMetrics, IncidentReport } from '../types';

interface AppStore extends AppState {
  // State update methods
  setCurrentPage: (page: AppState['currentPage']) => void;
  setSelectedProcessPid: (pid?: number) => void;
  updateProcesses: (processes: ProcessInfo[]) => void;
  updateAlerts: (alerts: Alert[]) => void;
  updateConnectionStatus: (status: ConnectionStatus) => void;
  
  // Real-time integration
  globalRankHistory: { time: string, score: number }[];
  connectWebSocket: () => void;
}

const initialSystemHealth: SystemHealthMetrics = {
    ringBufferFillPercentage: 0,
    eventsPerSecond: 0,
    eventsDropped: 0,
    ebpfProgramStatus: { 'shield_sensors': 'loaded' },
    featureVectorsPerSecond: 0,
    meanLatencyEventToVector: 0,
    pidCountTracked: 0,
    circularBufferMemory: 0,
    inferencesPerSecond: 0,
    meanInferenceLatency: 0,
    councilModelStatus: { 'inference_council': 'loaded' },
    xgboostModelVersion: '1.2.0',
    xgboostLoadTime: 45,
    falsePosRate24h: 0.001,
    falseNegRate24h: 0,
    rollingAUC: 0.99,
    thresholds: {
        MEDIUM: 0.35,
        HIGH: 0.65,
        CRITICAL: 0.85
    }
};

export const useAppStore = create<AppStore>((set, get) => {
  let ws: WebSocket | null = null;

  return {
    // Initial State
    currentPage: 'overview',
    selectedProcessPid: undefined,
    processes: [],
    alerts: [],
    reportsData: [],
    tamperLog: [],
    globalRankHistory: [], // Live history for the main chart
    scalerRecalibration: {
        lastRecalibration: Date.now(),
        nextScheduled: Date.now() + 3600000,
        benignSamplesInBuffer: 100,
        driftMetric: 0.02
    },
    systemHealth: initialSystemHealth,
    connectionStatus: { connected: false, lastHeartbeat: 0 },

    // Actions
    setCurrentPage: (page) => set({ currentPage: page }),
    setSelectedProcessPid: (pid) => set({ selectedProcessPid: pid }),
    updateProcesses: (processes) => set({ processes }),
    updateAlerts: (alerts) => set({ alerts }),
    updateConnectionStatus: (status) => set({ connectionStatus: status }),

    connectWebSocket: () => {
      if (ws) return;

      console.log("[🛡️] Connecting to S.H.I.E.L.D. Daemon...");
      ws = new WebSocket('ws://localhost:8080');

      ws.onopen = () => {
        set({ connectionStatus: { connected: true, lastHeartbeat: Date.now() } });
        console.log("[🛡️] Connected to Telemetry Bridge.");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'window_update') {
            set((state) => {
              const existingProcIdx = state.processes.findIndex(p => p.pid === data.pid);
              let updatedProcesses = [...state.processes];

              const newProc: ProcessInfo = {
                  pid: data.pid,
                  processName: data.comm,
                  executablePath: `/proc/${data.pid}/exe`,
                  startTime: Date.now(),
                  currentCpu: Math.random() * 5,
                  currentMemory: Math.random() * 100,
                  cgroupMembership: 'user.slice',
                  rankScore: data.score,
                  decisionLevel: data.score > 0.65 ? 'HIGH' : data.score > 0.35 ? 'MEDIUM' : 'BENIGN',
                  readCount: data.features ? data.features[48] : 0, // WRITE_COUNT
                  writeCount: data.features ? data.features[48] : 0,
                  meanEntropy: data.features ? data.features[25] : 0, // MEAN_ENTROPY
                  highEntropyRatio: data.features ? data.features[27] : 0,
                  rwRatio: data.features ? data.features[50] : 1.0,
                  entropyTrend: data.features ? data.features[30] : 0,
                  ioAcceleration: data.features ? data.features[40] : 0,
                  writeEntropyVolume: data.features ? data.features[60] : 0,
                  topSHAPFeature: 'Mean Entropy',
                  topSHAPValue: data.score * 0.4,
                  features: data.features,
                  radarScores: data.radar
              };

              if (existingProcIdx !== -1) {
                updatedProcesses[existingProcIdx] = { 
                  ...updatedProcesses[existingProcIdx], 
                  rankScore: data.score,
                  decisionLevel: data.score > 0.65 ? 'HIGH' : data.score > 0.35 ? 'MEDIUM' : 'BENIGN',
                  features: data.features,
                  radarScores: data.radar,
                  readCount: data.features ? data.features[48] : updatedProcesses[existingProcIdx].readCount,
                  writeCount: data.features ? data.features[48] : updatedProcesses[existingProcIdx].writeCount
                };
              } else {
                updatedProcesses.push(newProc);
              }

              // Update Global Rank History for the live chart
              const sorted = updatedProcesses.sort((a, b) => b.rankScore - a.rankScore);
              const topScore = sorted.length > 0 ? sorted[0].rankScore : 0;
              const newHistoryPoint = {
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                score: topScore
              };

              return { 
                  processes: sorted.slice(0, 50),
                  globalRankHistory: [...state.globalRankHistory, newHistoryPoint].slice(-60),
                  connectionStatus: { connected: true, lastHeartbeat: Date.now() }
              };
            });
          } else if (data.type === 'alert_update') {
            set((state) => {
              const newAlert: Alert = {
                alertId: `alert-${Date.now()}-${data.pid}`,
                timestamp: Date.now(),
                pid: data.pid,
                processName: data.comm,
                peakLevel: data.level === 'HIGH' ? 'HIGH' : 'MEDIUM',
                peakScore: data.level === 'HIGH' ? 0.88 : 0.45,
                duration: 500,
                outcome: 'Active',
                reportAvailable: true,
                latestScores: [0.1, 0.2, data.level === 'HIGH' ? 0.8 : 0.4]
              };

              const newReport: IncidentReport = {
                reportId: `REP-${Date.now()}`,
                incidentId: newAlert.alertId,
                timestamp: Date.now(),
                ransomwareFamily: data.level === 'HIGH' ? 'Generic Ransomware' : undefined,
                affectedPid: data.pid,
                severity: newAlert.peakLevel,
                mitreTechniques: ['T1486', 'T1059'],
                htmlContent: `<h3>Forensic Audit for ${data.comm} (PID: ${data.pid})</h3>
                             <p>Behaviors matching <b>Data Encrypted for Impact</b> were detected.</p>
                             <ul><li>High Entropy Write detected</li><li>Rapid File Renaming</li></ul>`,
                forensicArtifacts: [`/proc/${data.pid}/exe`, `sh-bin-${data.pid}.log`],
                responseActions: ['Process Throttled', 'Network Isolation Applied'],
                recommendedRemediation: ['Rollback to snapshot T-5m', 'Rotate service credentials']
              };
              
              const updatedAlerts = [newAlert, ...state.alerts].slice(0, 50);
              const updatedReports = [newReport, ...state.reportsData].slice(0, 20);
              return { 
                alerts: updatedAlerts,
                reportsData: updatedReports
              };
            });
          } else if (data.type === 'status_update') {
            set((state) => ({
              systemHealth: {
                ...state.systemHealth,
                eventsPerSecond: data.events_per_second,
                ringBufferFillPercentage: data.buffer_fill,
                pidCountTracked: state.processes.length
              }
            }));
          }
        } catch (e) {
          console.error("[🛡️] Malformed packet received.");
        }
      };

      ws.onclose = () => {
        set({ connectionStatus: { connected: false, lastHeartbeat: Date.now() } });
        ws = null;
        setTimeout(() => get().connectWebSocket(), 3000);
      };
    }
  };
});
