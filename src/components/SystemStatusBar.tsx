import React from 'react';
import { useAppStore } from '../store/appStore';
import { Shield } from 'lucide-react';

export const SystemStatusBar: React.FC = () => {
  const { processes, alerts, systemHealth } = useAppStore();  

  const activeMediumHighAlerts = alerts.filter(a => ['MEDIUM', 'HIGH', 'CONFIRMED'].includes(a.peakLevel)).length;

  let statusColor = '#22c55e';
  let statusLabel = 'HEALTHY';

  if (systemHealth.eventsDropped > 0) {
    statusColor = '#ef4444';
    statusLabel = 'CRITICAL';
  } else if (activeMediumHighAlerts >= 3) {
    statusColor = '#ef4444';
    statusLabel = 'CRITICAL';
  } else if (activeMediumHighAlerts >= 1) {
    statusColor = '#f97316';
    statusLabel = 'WARNING';
  } else if (systemHealth.meanLatencyEventToVector > 50) {
    statusColor = '#eab308';
    statusLabel = 'CAUTION';
  }

  const ringBufferPercentage = (systemHealth.eventsDropped > 0 ? 100 : (systemHealth.eventsPerSecond / 50000) * 100);

  return (
    <div className="h-16 bg-[#050810]/70 backdrop-blur-3xl border-b border-white/5 px-6 flex items-center justify-between shrink-0 text-xs shadow-md z-10 w-full whitespace-nowrap overflow-hidden relative">
      {/* Decorative gradient blur at top */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent"></div>
      
      <div className="flex items-center gap-8 z-10">
        <div className="flex items-center gap-4 border-r border-white/10 pr-8">
          <div className="flex items-center gap-2 text-neon-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
            <Shield size={20} />
            <span className="font-bold tracking-[0.3em] leading-none text-sm text-white">S.H.I.E.L.D</span>
          </div>
          <div className="w-px h-6 bg-white/10 mx-2"></div>
          <div className="flex flex-col justify-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">System Health</span>
            <div className="flex items-center gap-2 h-3">
              <div
                className="w-2.5 h-2.5 rounded-full shadow-lg"
                style={{ backgroundColor: statusColor, boxShadow: `0 0 10px ${statusColor}` }}
              />
              <span className="font-bold tracking-widest text-[11px] leading-none text-white drop-shadow-md">
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">Monitored</span>
          <span className="font-bold text-neon-cyan text-[11px] leading-none drop-shadow-md">{processes.length} PIDs</span>
        </div>

        <div className="flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">Alerts</span>
          <span
            className="font-bold text-[11px] leading-none drop-shadow-md"
            style={{ color: activeMediumHighAlerts > 0 ? '#ef4444' : '#22c55e' }}
          >
            {activeMediumHighAlerts} CRITICAL
          </span>
        </div>

        <div className="flex flex-col justify-center w-32">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none">Net Buffer</span>
            <span className="text-[9px] font-mono text-slate-400 leading-none">{ringBufferPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-dark-800/50 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-neon-cyan rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
              style={{ width: `${Math.min(100, ringBufferPercentage)}%` }}        
            />
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">Throughput</span>
          <span className="font-bold text-slate-200 text-[11px] leading-none drop-shadow-md">      
            {systemHealth.eventsPerSecond.toLocaleString()} PKT/s
          </span>
        </div>
      </div>
    </div>
  );
};
