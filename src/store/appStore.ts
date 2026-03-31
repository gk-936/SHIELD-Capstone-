import { create } from 'zustand';
import type { AppState, ProcessInfo, Alert, ConnectionStatus } from '../types';

interface AppStore extends AppState {
  // State update methods
  setCurrentPage: (page: AppState['currentPage']) => void;
  setSelectedProcessPid: (pid?: number) => void;
  updateProcesses: (processes: ProcessInfo[]) => void;
  updateAlerts: (alerts: Alert[]) => void;
  updateConnectionStatus: (status: ConnectionStatus) => void;
  
  // Real-time integration
  connectWebSocket: () => void;
}

export const useAppStore = create<AppStore>((set, get) => {
  let ws: WebSocket | null = null;

  const connectWebSocket = () => {
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
                name: data.comm,
                rankScore: data.score,
                decisionLevel: data.score > 0.6 ? 'HIGH' : data.score > 0.3 ? 'MEDIUM' : 'BENIGN',
                readCount: 0,
                writeCount: 0,
                meanEntropy: 0,
                highEntropyRatio: 0,
                rwRatio: 0,
                entropyTrend: 0,
                ioAcceleration: 0,
                writeEntropyVolume: 0,
                currentCpu: 0,
                currentMemory: 0,
                lastSeen: Date.now()
            };

            if (existingProcIdx !== -1) {
              updatedProcesses[existingProcIdx] = { ...updatedProcesses[existingProcIdx], rankScore: data.score };
            } else {
              updatedProcesses.push(newProc);
            }

            return { 
                processes: updatedProcesses.sort((a, b) => b.rankScore - a.rankScore).slice(0, 50),
                connectionStatus: { connected: true, lastHeartbeat: Date.now() }
            };
          });
        }
      } catch (e) {
        console.error("[🛡️] Malformed packet received.");
      }
    };

    ws.onclose = () => {
      ws = null;
      set({ connectionStatus: { connected: false, lastHeartbeat: Date.now() } });
      console.log("[🛡️] Disconnected. Retrying...");
      setTimeout(() => get().connectWebSocket(), 3000);
    };
  };

  return {
    // Initial state (Empty - waiting for real data)
    currentPage: 'overview',
    selectedProcessPid: undefined,
    processes: [],
    alerts: [],
    systemHealth: {
        ringBufferFillPercentage: 0,
        eventsPerSecond: 0,
        alertsToday: 0,
        modelStatus: 'LOADED',
        version: '1.0.0-PROD'
    },
    reportsData: [],
    tamperLog: [],
    scalerRecalibration: { lastRecalibration: Date.now(), nextScheduled: Date.now() + 86400000, driftMetric: 0 },
    connectionStatus: {
      connected: false,
      lastHeartbeat: Date.now(),
    },

    // Methods
    setCurrentPage: (page) => set({ currentPage: page }),
    setSelectedProcessPid: (pid) => set({ selectedProcessPid: pid }),
    updateProcesses: (processes) => set({ processes }),
    updateAlerts: (alerts) => set({ alerts }),
    updateConnectionStatus: (status) => set({ connectionStatus: status }),
    connectWebSocket,
  };
});
