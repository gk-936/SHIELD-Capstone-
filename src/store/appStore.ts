import { create } from 'zustand';
import type { AppState, ProcessInfo, Alert, ConnectionStatus } from '../types';
import {
  generateProcessInfo,
  generateAlerts,
  generateSystemHealthMetrics,
  generateIncidentReports,
  generateTamperEvents,
  generateScalerRecalibration,
} from '../mock/generators';

interface AppStore extends AppState {
  // State update methods
  setCurrentPage: (page: AppState['currentPage']) => void;
  setSelectedProcessPid: (pid?: number) => void;
  updateProcesses: (processes: ProcessInfo[]) => void;
  updateAlerts: (alerts: Alert[]) => void;
  updateConnectionStatus: (status: ConnectionStatus) => void;
  
  // Data mutation methods
  updateMockData: () => void;
  simulateWebSocketUpdate: () => void;
}

// Initial mock data
const initialProcesses = Array.from({ length: 12 }, (_, i) => {
  const levels = ['BENIGN', 'BENIGN', 'SUSPICIOUS', 'MEDIUM', 'HIGH'] as const;
  return generateProcessInfo(2000 + i, levels[i % 5]);
}).sort((a, b) => b.rankScore - a.rankScore);

const initialAlerts = generateAlerts(8);
const initialSystemHealth = generateSystemHealthMetrics();
const initialReports = generateIncidentReports(5);
const initialTamperLog = generateTamperEvents();
const initialScalerRecal = generateScalerRecalibration();

export const useAppStore = create<AppStore>((set) => {
  // Set up WebSocket simulation interval
  setInterval(() => {
    set((state) => {
      // Slightly modify process data to simulate live updates
      const updatedProcesses = state.processes.map(proc => ({
        ...proc,
        rankScore: Math.max(0, Math.min(1, proc.rankScore + (Math.random() - 0.5) * 0.05)),
        readCount: proc.readCount + Math.floor(Math.random() * 10),
        writeCount: proc.writeCount + Math.floor(Math.random() * 10),
        meanEntropy: Math.max(0, Math.min(8, proc.meanEntropy + (Math.random() - 0.5) * 0.2)),
        currentCpu: Math.max(0, proc.currentCpu + (Math.random() - 0.5) * 5),
        currentMemory: Math.max(0, proc.currentMemory + (Math.random() - 0.5) * 50),
      })).sort((a, b) => b.rankScore - a.rankScore);

      // Occasionally update alerts
      const updatedAlerts = Math.random() > 0.7
        ? [generateAlerts(1)[0], ...state.alerts.slice(0, 7)]
        : state.alerts;

      // Update system health slightly
      const updatedSystemHealth = {
        ...state.systemHealth,
        ringBufferFillPercentage: Math.max(0, Math.min(100, 
          state.systemHealth.ringBufferFillPercentage + (Math.random() - 0.5) * 5
        )),
        eventsPerSecond: Math.max(100, state.systemHealth.eventsPerSecond + Math.floor((Math.random() - 0.5) * 500)),
      };

      return {
        processes: updatedProcesses,
        alerts: updatedAlerts,
        systemHealth: updatedSystemHealth,
        connectionStatus: {
          connected: true,
          lastHeartbeat: Date.now(),
        },
      };
    });
  }, 5000);

  return {
    // Initial state
    currentPage: 'overview',
    selectedProcessPid: undefined,
    processes: initialProcesses,
    alerts: initialAlerts,
    systemHealth: initialSystemHealth,
    reportsData: initialReports,
    tamperLog: initialTamperLog,
    scalerRecalibration: initialScalerRecal,
    connectionStatus: {
      connected: true,
      lastHeartbeat: Date.now(),
    },

    // Methods
    setCurrentPage: (page) => set({ currentPage: page }),
    
    setSelectedProcessPid: (pid) => set({ selectedProcessPid: pid }),
    
    updateProcesses: (processes) => set({ processes }),
    
    updateAlerts: (alerts) => set({ alerts }),
    
    updateConnectionStatus: (status) => set({ connectionStatus: status }),
    
    updateMockData: () => {
      set({
        processes: Array.from({ length: 12 }, () => generateProcessInfo()).sort((a, b) => b.rankScore - a.rankScore),
        alerts: generateAlerts(8),
        systemHealth: generateSystemHealthMetrics(),
        reportsData: generateIncidentReports(5),
        tamperLog: generateTamperEvents(),
        scalerRecalibration: generateScalerRecalibration(),
      });
    },
    
    simulateWebSocketUpdate: () => {
      // This is called by the WebSocket update interval
      // The actual updates are handled by setInterval in the store creation
    },
  };
});

// Clean up interval on store destruction
export const initializeWebSocketSimulation = () => {
  // Already initialized in create function above
};
