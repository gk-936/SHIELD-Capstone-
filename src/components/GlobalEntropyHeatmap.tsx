import React, { useMemo } from 'react';
import type { ProcessInfo } from '../types';
import { useAppStore } from '../store/appStore';

function getDeepHeatmapColor(entropy: number): string {
    const val = Math.min(1, Math.max(0, entropy / 8));
    if (val < 0.5) {
        const t = val * 2;
        const r = Math.round(15 + (126 - 15) * t);
        const g = Math.round(23 + (34 - 23) * t);
        const b = Math.round(42 + (206 - 42) * t);
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        const t = (val - 0.5) * 2;
        const r = Math.round(126 + (239 - 126) * t);
        const g = Math.round(34 + (68 - 34) * t);
        const b = Math.round(206 + (68 - 206) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }
}

export const GlobalEntropyHeatmap: React.FC = () => {
  const { processes, setCurrentPage, setSelectedProcessPid } = useAppStore();   

  const heatmapCells = useMemo(() => {
    // Filter out zero entropy (inactive slots) for the active view, but keep at least 36 slots
    const active = processes.filter(p => p.meanEntropy > 0);
    const sorted = [...active].sort((a, b) => b.meanEntropy - a.meanEntropy).slice(0, 36);
    
    const padded = [...sorted];
    while (padded.length < 36) {
      padded.push(undefined as unknown as ProcessInfo);
    }
    return padded;
  }, [processes]);

  const handleCellClick = (pid: number) => {
    setSelectedProcessPid(pid);
    setCurrentPage('process-detail');
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 h-full flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-5 bg-neon-cyan rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">
          Entropy Heatmap
        </h2>
      </div>

      {/* Heatmap Grid Wrapper */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0 relative">
        <div className="grid grid-cols-6 gap-1.5 p-3 bg-black/20 border border-white/5 rounded-2xl backdrop-blur-md shadow-inner w-full justify-items-center">
          {heatmapCells.map((process, i) => (
            <div
              key={i}
              className="relative group cursor-pointer transition-all duration-200 hover:z-10 hover:scale-110"
              onClick={() => process && handleCellClick(process.pid)}
            >
              {process ? (
                <>
                  <div
                    className="w-10 h-10 flex flex-col items-center justify-center rounded-sm text-[9px] font-mono font-bold border border-white/5 shadow-inner"
                    style={{
                      backgroundColor: getDeepHeatmapColor(process.meanEntropy),
                      color: 'rgba(255, 255, 255, 0.9)',
                      boxShadow: process.meanEntropy > 6 ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none'
                    }}
                  >
                    <span>{process.meanEntropy.toFixed(1)}</span>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#080d1a] border border-dark-600 rounded p-2 whitespace-nowrap text-xs shadow-xl transition-opacity pointer-events-none z-50">
                    <p className="font-bold text-white mb-1">{process.processName}</p>  
                    <p className="text-[10px] text-gray-400 font-mono">PID: {process.pid}</p>     
                    <p className="text-[10px] text-neon-cyan font-mono mt-0.5">Entropy: {process.meanEntropy.toFixed(3)}</p>
                  </div>
                </>
              ) : (
                <div className="w-10 h-10 rounded-sm border border-dark-700/20 bg-dark-800/10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
