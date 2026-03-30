import React, { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { generateProcessInfo, generateRankHistory } from '../mock/generators';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DecisionLevelBadge, ProgressBar, StatsCard } from '../components/SharedComponents';
import { SHAPWaterfallPlot } from '../components/SHAPWaterfallPlot';
import { CouncilRadarChart } from '../components/CouncilRadarChart';
import { FeatureVectorTable } from '../components/FeatureVectorTable';
import { IOEventTimeline } from '../components/IOEventTimeline';
import { EnforcementHistory } from '../components/EnforcementHistory';
import { RelatedProcesses } from '../components/RelatedProcesses';
import { formatDate } from '../utils/helpers';
import { ArrowLeft, Cpu, HardDrive } from 'lucide-react';

export const ProcessDetailPage: React.FC = () => {
  const { selectedProcessPid, setCurrentPage, processes } = useAppStore();

  const processData = useMemo(() => {
    if (!selectedProcessPid) return null;
    return processes.find(p => p.pid === selectedProcessPid) || generateProcessInfo(selectedProcessPid);
  }, [selectedProcessPid, processes]);

  const rankHistory = useMemo(() => {
    const history = generateRankHistory(60);
    return history.map((item, index) => ({
      index: index,
      time: new Date(item.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      score: item.score,
      weighted: item.weightedScore || item.score,
    }));
  }, [selectedProcessPid]);

  if (!processData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-900">
        <p className="text-gray-500">No process selected</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-dark-900">
      {/* Header */}
      <div className="glass border-b border-dark-700 border-opacity-40 px-6 py-4">
        <button
          onClick={() => setCurrentPage('overview')}
          className="flex items-center gap-2 mb-4 text-neon-cyan hover:text-neon-cyan transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Overview</span>
        </button>

        <div className="grid grid-cols-6 gap-4">
          {/* Process Info */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Process Name</p>
            <p className="text-lg font-semibold text-gray-100">{processData.processName}</p>
            <p className="text-xs text-gray-500 mt-1">PID: {processData.pid}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Executable</p>
            <p className="text-sm font-mono text-gray-400 truncate">{processData.executablePath}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Parent Process</p>
            <p className="text-sm text-gray-100">{processData.parentName || 'N/A'}</p>
            <p className="text-xs text-gray-500">PID {processData.parentPid || '—'}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Start Time</p>
            <p className="text-sm text-gray-100">{formatDate(processData.startTime)}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Decision Level</p>
            <DecisionLevelBadge level={processData.decisionLevel} size="md" />
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rank Score</p>
            <ProgressBar
              value={processData.rankScore}
              min={0}
              max={1}
              showValue={true}
              valueFormatter={(v) => v.toFixed(3)}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area - Tabs */}
      <div className="flex-1 overflow-auto p-4">
        {/* Stats Cards Row */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <StatsCard
            title="CPU Usage"
            value={`${processData.currentCpu.toFixed(1)}%`}
            icon={<Cpu size={18} />}
          />
          <StatsCard
            title="Memory"
            value={`${processData.currentMemory.toFixed(0)} MB`}
            icon={<HardDrive size={18} />}
          />
          <StatsCard
            title="Mean Entropy"
            value={`${(processData.meanEntropy / 8).toFixed(2)}`}
            subtitle="(normalized to 1.0)"
          />
          <StatsCard
            title="Read Count"
            value={processData.readCount.toLocaleString()}
          />
          <StatsCard
            title="Write Count"
            value={processData.writeCount.toLocaleString()}
          />
        </div>

        {/* Grid Layout for Detail Sections */}
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column - 60 Second Rank Chart */}
          <div className="col-span-6">
            <div className="glass rounded-lg p-4 h-full flex flex-col">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neon-cyan mb-4">
                60-Second Rank History
              </h3>
              <div className="flex-1" style={{ minHeight: '0px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rankHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" vertical={false} />
                    <XAxis
                      dataKey="time"
                      stroke="#6b7280"
                      fontSize={10}
                      tick={{ fill: '#9ca3af' }}
                      interval={Math.floor(rankHistory.length / 5)}
                    />
                    <YAxis
                      stroke="#6b7280"
                      domain={[0, 1]}
                      fontSize={10}
                      tick={{ fill: '#9ca3af' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f1628',
                        border: '1px solid #1a2332',
                      }}
                      formatter={(value) => [
                        `${(value as number).toFixed(3)}`,
                        'Score',
                      ]}
                    />
                    <Line type="monotone" dataKey="score" stroke="#00d9ff" dot={false} strokeWidth={2} />
                    <Line
                      type="monotone"
                      dataKey="weighted"
                      stroke="#ffa500"
                      dot={false}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column Top - SHAP Waterfall */}
          <div className="col-span-6">
            <SHAPWaterfallPlot pid={processData.pid} />
          </div>

          {/* Below - Feature Vector Table (full width) */}
          <div className="col-span-6">
            <FeatureVectorTable pid={processData.pid} />
          </div>

          {/* Below - Council Model Radar Chart */}
          <div className="col-span-6">
            <CouncilRadarChart pid={processData.pid} />
          </div>

          {/* Below - I/O Event Timeline (full width) */}
          <div className="col-span-12">
            <IOEventTimeline pid={processData.pid} />
          </div>

          {/* Below - Enforcement History and Related Processes */}
          <div className="col-span-6">
            <EnforcementHistory pid={processData.pid} />
          </div>

          <div className="col-span-6">
            <RelatedProcesses
              pid={processData.pid}
              parentPid={processData.parentPid}
              parentName={processData.parentName}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
