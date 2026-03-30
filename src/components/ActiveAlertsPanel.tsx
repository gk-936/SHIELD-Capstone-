import React from 'react';
import { useAppStore } from '../store/appStore';
import { DECISION_COLORS } from '../types';
import type { Alert } from '../types';

export const ActiveAlertsPanel: React.FC = () => {
  const { alerts, setCurrentPage, setSelectedProcessPid } = useAppStore();      

  const activeAlerts = alerts
    .filter(a => ['MEDIUM', 'HIGH', 'CONFIRMED'].includes(a.peakLevel))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  const handleAlertClick = (alert: Alert) => {
    setSelectedProcessPid(alert.pid);
    setCurrentPage('process-detail');
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 h-full flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-5 bg-neon-amber rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Active Alerts</h2>
        <span className="ml-auto text-[10px] font-mono bg-neon-amber/20 text-neon-amber px-2 py-0.5 rounded">
          {activeAlerts.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-0 divide-y divide-dark-700/30">
        {activeAlerts.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-gray-500 font-mono">NO ACTIVE THREATS</p>
          </div>
        ) : (
          activeAlerts.map((alert) => {
            const color = DECISION_COLORS[alert.peakLevel];
            const scorePct = Math.min(100, Math.max(0, alert.peakScore * 100));

            return (
              <div
                key={alert.alertId}
                className="py-2.5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                onClick={() => handleAlertClick(alert)}
              >
                <div 
                  className="pl-2 border-l-2" 
                  style={{ borderColor: color }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">
                        [{alert.pid}]
                      </span>
                      <span className="text-xs font-semibold text-gray-100 truncate">
                        {alert.processName}
                      </span>
                      <span 
                        className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ color: color, backgroundColor: color + '20' }}
                      >
                        {alert.peakLevel}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 group-hover:text-neon-cyan transition-colors">
                      {(alert.peakScore).toFixed(3)}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-1 w-full bg-dark-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${scorePct}%`,
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}80`
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
