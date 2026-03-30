import React, { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { DECISION_COLORS } from '../types';
import { DecisionLevelBadge } from './SharedComponents';

export const TopProcessesTable: React.FC = () => {
  const { processes, setCurrentPage, setSelectedProcessPid } = useAppStore();

  const topProcesses = useMemo(() => {
    return processes
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 10);
  }, [processes]);

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 h-full flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden">
      <div className="flex items-center gap-3 mb-6 relative z-20">
        <div className="w-1.5 h-5 bg-neon-cyan rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Top Suspicious Processes</h2>
        <span className="ml-auto text-[10px] font-mono bg-neon-cyan/5 text-neon-cyan px-3 py-1 rounded-full border border-neon-cyan/20 backdrop-blur-md">
          Refreshing every 5sec
        </span>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-dark-700/40 bg-[#080d1a]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0e1628] border-b border-dark-700/50 shadow-md z-10">
            <tr>
              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-12 text-center">Rank</th>
              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">PID / Process</th>
              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-24 text-center">Decision</th>
              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/30">
            {topProcesses.length === 0 ? (
              <tr>
                <td colSpan={4} className="h-32 text-center text-xs text-gray-500 font-mono">
                  NO DATA
                </td>
              </tr>
            ) : (
              topProcesses.map((p, index) => {
                const isTop = index < 3;
                const scoreColor = DECISION_COLORS[p.decisionLevel];
                const scorePct = Math.min(100, Math.max(0, p.rankScore * 100));

                return (
                  <tr 
                    key={p.pid}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => {
                      setSelectedProcessPid(p.pid);
                      setCurrentPage('process-detail');
                    }}
                  >
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-lg font-bold font-mono ${isTop ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white group-hover:text-neon-cyan transition-colors">
                          {p.processName}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          PID: {p.pid}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <DecisionLevelBadge level={p.decisionLevel} size="sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-gray-300 w-10">
                          {p.rankScore.toFixed(3)}
                        </span>
                        <div className="flex-1 h-1.5 bg-dark-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${scorePct}%`,
                              backgroundColor: scoreColor,
                              boxShadow: `0 0 6px ${scoreColor}80`
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
