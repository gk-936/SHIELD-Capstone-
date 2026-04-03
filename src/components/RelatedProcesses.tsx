import React, { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { DecisionLevelBadge } from './SharedComponents';
import { GitBranch } from 'lucide-react';

interface RelatedProcessesProps {
  pid?: number;
  parentPid?: number;
  parentName?: string;
}

export const RelatedProcesses: React.FC<RelatedProcessesProps> = ({
  pid,
  parentPid,
}) => {
  const { setCurrentPage, setSelectedProcessPid } = useAppStore();

  const { processes } = useAppStore();
  
  const { parent, children } = useMemo(() => {
    return {
      parent: parentPid ? processes.find(p => p.pid === parentPid) || null : null,
      children: processes.filter(p => p.parentPid === pid),
    };
  }, [pid, parentPid, processes]);

  const handleProcessClick = (selectedPid: number) => {
    setSelectedProcessPid(selectedPid);
    setCurrentPage('process-detail');
  };

  if (!pid) {
    return (
      <div className="glass rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select a process to view related processes</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch size={16} className="text-neon-cyan" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neon-cyan">
          Related Processes
        </h3>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* Parent Process */}
        {parent && (
          <div className="border border-dark-600 border-opacity-40 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Parent Process</p>
            <div
              className="cursor-pointer hover:bg-dark-700 hover:bg-opacity-30 p-2 rounded transition-all"
              onClick={() => handleProcessClick(parent.pid)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-100">{parent.processName}</p>
                  <p className="text-xs text-gray-500">PID {parent.pid}</p>
                </div>
                <DecisionLevelBadge level={parent.decisionLevel} size="sm" />
              </div>
              <p className="text-xs text-gray-600">{parent.executablePath}</p>
              <p className="text-xs text-neon-cyan mt-1">
                Score: {parent.rankScore.toFixed(3)}
              </p>
            </div>
          </div>
        )}

        {/* Child Processes */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Child Processes</p>
          <div className="space-y-2">
            {children.length === 0 ? (
              <p className="text-xs text-gray-600">No child processes</p>
            ) : (
              children.map((child) => (
                <div
                  key={child.pid}
                  className="border border-dark-600 border-opacity-40 rounded-lg p-2 cursor-pointer hover:bg-dark-700 hover:bg-opacity-30 transition-all"
                  onClick={() => handleProcessClick(child.pid)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-100">{child.processName}</p>
                      <p className="text-xs text-gray-500">PID {child.pid}</p>
                    </div>
                    <DecisionLevelBadge level={child.decisionLevel} size="sm" />
                  </div>
                  <p className="text-xs text-neon-cyan">
                    Score: {child.rankScore.toFixed(3)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
