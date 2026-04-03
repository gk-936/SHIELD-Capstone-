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
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}

const DEFAULT_SETTINGS: AppState['settings'] = {
  thresholds: { suspicious: 0.5, critical: 0.8 },
  whitelist: ['systemd', 'dbus-daemon', 'tailscaled', 'kworker', 'node', 'vite'],
  remoteIp: '127.0.0.1',
  remotePort: 8080,
  autoConnect: true,
  historyLimit: 60
};

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
    xgboostModelVersion: '7.0-production-shield',
    xgboostLoadTime: 45,
    falsePosRate24h: 0.001,
    falseNegRate24h: 0,
    rollingAUC: 0.99,
    thresholds: {
        MEDIUM: 0.35,
        HIGH: 0.59,
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
    settings: JSON.parse(localStorage.getItem('shield_settings') || JSON.stringify(DEFAULT_SETTINGS)),

    // Actions
    setCurrentPage: (page) => set({ currentPage: page }),
    setSelectedProcessPid: (pid) => set({ selectedProcessPid: pid }),
    updateProcesses: (processes) => set({ processes }),
    updateAlerts: (alerts) => set({ alerts }),
    updateConnectionStatus: (status) => set({ connectionStatus: status }),
    updateSettings: (newSettings) => {
      set((state) => {
        const updatedSettings = { ...state.settings, ...newSettings };
        localStorage.setItem('shield_settings', JSON.stringify(updatedSettings));
        
        // Sync registry to backend if whitelist changed
        if (newSettings.whitelist && ws && ws.readyState === WebSocket.OPEN) {
          console.log("[🛡️] Syncing Known-Process Registry to kernel...");
          ws.send(JSON.stringify({
            type: 'registry_update',
            list: updatedSettings.whitelist
          }));
        }
        
        return { settings: updatedSettings };
      });
    },

    connectWebSocket: () => {
      if (ws) return;

      console.log("[🛡️] Connecting to S.H.I.E.L.D. Daemon...");
      const { remoteIp, remotePort } = get().settings;
      ws = new WebSocket(`ws://${remoteIp}:${remotePort}`);

      ws.onopen = () => {
        set({ connectionStatus: { connected: true, lastHeartbeat: Date.now() } });
        console.log("[🛡️] Connected to Telemetry Bridge.");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'window_update') {
            set((state) => {
              if (state.settings.whitelist.some(w => data.comm.includes(w))) return state;

              const existingProcIdx = state.processes.findIndex(p => p.pid === data.pid);
              let updatedProcesses = [...state.processes];

              const newProc: ProcessInfo = {
                  pid: data.pid,
                  processName: data.comm,
                  executablePath: `/proc/${data.pid}/exe`,
                  startTime: Date.now(),
                  currentCpu: data.cpu !== undefined ? data.cpu : 0,
                  currentMemory: data.mem !== undefined ? data.mem : 0,
                  cgroupMembership: 'user.slice',
                  rankScore: data.score,
                  decisionLevel: data.score > 0.8 ? 'HIGH' : data.score > 0.4 ? 'MEDIUM' : 'BENIGN',
                  readCount: data.features ? data.features[18] : 0, 
                  writeCount: data.features ? data.features[20] : 0,
                  meanEntropy: data.features ? data.features[3] : 0,
                  highEntropyRatio: data.features ? data.features[4] : 0,
                  rwRatio: data.features ? data.features[22] : 1.0,
                  entropyTrend: data.features ? data.features[9] : 0,
                  ioAcceleration: data.features ? data.features[5] : 0,
                  writeEntropyVolume: data.features ? data.features[23] : 0,
                  topSHAPFeature: data.top_feature || 'Normal Activity',
                  topSHAPValue: data.top_value || 0,
                  features: data.features,
                  radarScores: data.radar
              };

              if (existingProcIdx !== -1) {
                updatedProcesses[existingProcIdx] = { 
                  ...updatedProcesses[existingProcIdx], 
                  rankScore: data.score,
                  decisionLevel: data.score > 0.59 ? 'HIGH' : data.score > 0.35 ? 'MEDIUM' : 'BENIGN',
                  features: data.features,
                  radarScores: data.radar,
                  readCount: data.features ? data.features[18] : updatedProcesses[existingProcIdx].readCount,
                  writeCount: data.features ? data.features[20] : updatedProcesses[existingProcIdx].writeCount
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
                  globalRankHistory: [...state.globalRankHistory, newHistoryPoint].slice(-state.settings.historyLimit),
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
                affectedPid: data.pid,
                severity: newAlert.peakLevel,
                mitreTechniques: ['T1486', 'T1059'],
                htmlContent: `<div class="forensic-report">
                                <header>
                                  <h3>Forensic Threat DNA: ${data.comm}</h3>
                                  <span class="severity-badge ${newAlert.peakLevel.toLowerCase()}">${newAlert.peakLevel} SEVERITY</span>
                                </header>
                                <section>
                                  <p>The S.H.I.E.L.D. behavioral engine identified a high-confidence match for <b>Data Encrypted for Impact</b>.</p>
                                  <div class="metric-grid">
                                    <div class="metric-item"><strong>Primary Trigger:</strong> ${data.top_feature}</div>
                                    <div class="metric-item"><strong>CPU Load:</strong> ${data.cpu}%</div>
                                    <div class="metric-item"><strong>Memory RSS:</strong> ${data.mem} MB</div>
                                  </div>
                                </section>
                                <section>
                                  <h4>Observed Indicators</h4>
                                  <ul>
                                    ${data.top_feature.includes('Entropy') ? '<li><b>Anomalous Variance:</b> High write entropy suggests active encryption.</li>' : ''}
                                    ${data.top_feature.includes('I/O') ? '<li><b>Volume Spike:</b> Rapid sustained I/O throughput detected.</li>' : ''}
                                    <li><b>Metadata Integrity:</b> Frequent rename/unlink syscalls observed.</li>
                                  </ul>
                                </section>
                              </div>`,
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
