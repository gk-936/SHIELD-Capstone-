import React, { useMemo } from 'react';
import { generateEnforcementActions } from '../mock/generators';
import { formatTime } from '../utils/helpers';
import { Zap } from 'lucide-react';

interface EnforcementHistoryProps {
  pid?: number;
}

export const EnforcementHistory: React.FC<EnforcementHistoryProps> = ({ pid }) => {
  const actions = useMemo(() => generateEnforcementActions(), [pid]);

  const getActionColor = (action: string) => {
    if (action.includes('SIGKILL')) return '#ff4444';
    if (action.includes('SIGSTOP')) return '#ffa500';
    if (action.includes('SIGCONT')) return '#ffd700';
    if (action.includes('throttle_applied')) return '#ff9999';
    if (action.includes('throttle_released')) return '#00ff41';
    return '#00d9ff';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('throttle')) return '⏱️';
    if (action.includes('SIGSTOP')) return '⏸️';
    if (action.includes('SIGCONT')) return '▶️';
    if (action.includes('SIGKILL')) return '❌';
    return '⚡';
  };

  if (!pid) {
    return (
      <div className="glass rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">Select a process to view enforcement history</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={16} className="text-neon-amber" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neon-amber">
          Enforcement History
        </h3>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {actions.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-8">No enforcement actions</p>
        ) : (
          actions.map((action, idx) => (
            <div
              key={idx}
              className="border-l-4 pl-3 py-2"
              style={{ borderColor: getActionColor(action.action) }}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span>{getActionIcon(action.action)}</span>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: getActionColor(action.action) }}
                  >
                    {action.action.replace(/_/g, ' ').toUpperCase()}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  {formatTime(action.timestamp)}
                </p>
              </div>
              <p className="text-xs text-gray-400 mb-1">{action.description}</p>
              <p className="text-xs text-gray-500">
                Rank Score: <span style={{ color: getActionColor(action.action) }}>
                  {action.triggeringRankScore.toFixed(3)}
                </span>
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
