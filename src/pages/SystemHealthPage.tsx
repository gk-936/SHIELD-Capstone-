import React, { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Gauge, StatusIndicator, StatsCard } from '../components/SharedComponents';
import { formatDate, formatPercentage, isCritical } from '../utils/helpers';
import {
  Activity,
  AlertTriangle,
  Clock,
  Zap,
  Heart,
  Cpu,
} from 'lucide-react';

export const SystemHealthPage: React.FC = () => {
  const { systemHealth, tamperLog, scalerRecalibration } = useAppStore();

  // Generate time-series data for charts
  const eventsPerSecondData = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      time: `${i}m`,
      value: systemHealth.eventsPerSecond + Math.sin(i / 10) * 500,
    }));
  }, [systemHealth.eventsPerSecond]);

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-dark-900">
      <div className="p-6 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-100 mb-1">System Health & Model Metrics</h1>
          <p className="text-sm text-gray-500">Real-time monitoring of S.H.I.E.L.D system components</p>
        </div>

        {/* eBPF Sensor Health Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-neon-cyan" />
            <h2 className="text-lg font-semibold text-gray-100">eBPF Sensor Health</h2>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            {/* Ring Buffer Gauge */}
            <div className="glass rounded-lg p-4">
              <Gauge
                value={systemHealth.ringBufferFillPercentage}
                max={100}
                label="Ring Buffer"
                unit="%"
                size={100}
              />
            </div>

            {/* Events Per Second */}
            <div className="glass rounded-lg p-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Events/sec</p>
                <p className="text-3xl font-bold text-neon-cyan">
                  {(systemHealth.eventsPerSecond / 1000).toFixed(1)}K
                </p>
              </div>
            </div>

            {/* Events Dropped */}
            <div className="glass rounded-lg p-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Events Dropped</p>
                <p
                  className="text-3xl font-bold"
                  style={{
                    color: systemHealth.eventsDropped > 0 ? '#ff4444' : '#00ff41',
                  }}
                >
                  {systemHealth.eventsDropped}
                </p>
                {systemHealth.eventsDropped > 0 && (
                  <p className="text-xs text-red-400 mt-1">⚠️ Data loss detected</p>
                )}
              </div>
            </div>

            {/* eBPF Programs */}
            <div className="glass rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">eBPF Programs</p>
              <div className="space-y-2">
                {Object.entries(systemHealth.ebpfProgramStatus).map(([program, status]) => (
                  <div key={program} className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">{program}</p>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: status === 'loaded' ? '#00ff41' : '#ff4444',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Events Per Second Chart */}
          <div className="glass rounded-lg p-4">
            <h3 className="text-sm font-semibold text-neon-cyan mb-4">Events Per Second (Last Hour)</h3>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={eventsPerSecondData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" />
                  <XAxis
                    dataKey="time"
                    stroke="#6b7280"
                    fontSize={11}
                    tick={{ fill: '#9ca3af' }}
                    interval={10}
                  />
                  <YAxis stroke="#6b7280" fontSize={11} tick={{ fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f1628', border: '1px solid #1a2332' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#00d9ff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Feature Engine Health Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={18} className="text-neon-amber" />
            <h2 className="text-lg font-semibold text-gray-100">Feature Engine Health</h2>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <StatsCard
              title="Feature Vectors/sec"
              value={systemHealth.featureVectorsPerSecond.toFixed(0)}
            />
            <StatsCard
              title="Event-to-Vector Latency"
              value={`${systemHealth.meanLatencyEventToVector.toFixed(1)}ms`}
              trend={isCritical(systemHealth.meanLatencyEventToVector, 50) ? 'up' : 'down'}
            />
            <StatsCard
              title="PIDs Tracked"
              value={systemHealth.pidCountTracked}
            />
            <StatsCard
              title="Buffer Memory"
              value={`${systemHealth.circularBufferMemory}MB`}
            />
          </div>
        </section>

        {/* Inference Engine Health Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-neon-cyan" />
            <h2 className="text-lg font-semibold text-gray-100">Inference Engine Health</h2>
          </div>

          <div className="glass rounded-lg p-4 mb-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Inferences/sec</p>
                <p className="text-2xl font-bold text-neon-cyan">{systemHealth.inferencesPerSecond.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Mean Inference Latency
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{
                    color: isCritical(systemHealth.meanInferenceLatency, 10) ? '#ff4444' : '#00d9ff',
                  }}
                >
                  {systemHealth.meanInferenceLatency.toFixed(1)}ms
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">XGBoost Model</p>
                <p className="text-sm text-gray-100">{systemHealth.xgboostModelVersion}</p>
                <p className="text-xs text-gray-500">Loaded in {systemHealth.xgboostLoadTime}ms</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Model Status</p>
                <StatusIndicator status="success" label="Operational" />
              </div>
            </div>
          </div>

          {/* Council Model Status */}
          <div className="glass rounded-lg p-4">
            <h3 className="text-sm font-semibold text-neon-cyan mb-4">Council Model Status</h3>
            <div className="grid grid-cols-6 gap-4">
              {Object.entries(systemHealth.councilModelStatus).map(([model, status]) => (
                <div
                  key={model}
                  className="border border-dark-600 border-opacity-40 rounded-lg p-3 text-center"
                >
                  <p className="text-xs font-mono text-gray-400 mb-2">{model}</p>
                  <div
                    className="w-3 h-3 rounded-full mx-auto"
                    style={{
                      backgroundColor: status === 'loaded' ? '#00ff41' : '#ff4444',
                    }}
                  />
                  <p className="text-xs mt-2" style={{ color: status === 'loaded' ? '#00ff41' : '#ff4444' }}>
                    {status === 'loaded' ? 'Loaded' : 'Error'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Model Performance Metrics Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Heart size={18} className="text-red-400" />
            <h2 className="text-lg font-semibold text-gray-100">Model Performance Metrics</h2>
          </div>

          <div className="glass rounded-lg p-4 mb-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">False Positive Rate (24h)</p>
                <p className="text-2xl font-bold text-neon-cyan">{formatPercentage(systemHealth.falsePosRate24h)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">False Negative Rate (24h)</p>
                <p className="text-2xl font-bold text-neon-cyan">{formatPercentage(systemHealth.falseNegRate24h)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Rolling AUC</p>
                <p className="text-2xl font-bold text-neon-cyan">{systemHealth.rollingAUC.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Model Status</p>
                <StatusIndicator status="success" label="Optimal" />
              </div>
            </div>
          </div>

          {/* Thresholds */}
          <div className="glass rounded-lg p-4">
            <h3 className="text-sm font-semibold text-neon-cyan mb-4">Decision Thresholds</h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(systemHealth.thresholds).map(([threshold, value]) => (
                <div key={threshold} className="border border-dark-600 border-opacity-40 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{threshold}</p>
                  <p className="text-2xl font-bold text-gray-100 mt-2">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tamper Detection Log Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-neon-amber" />
            <h2 className="text-lg font-semibold text-gray-100">Tamper Detection Log</h2>
          </div>

          <div className="glass rounded-lg p-4">
            {tamperLog.length === 0 ? (
              <p className="text-gray-500 text-sm">No tampering attempts detected</p>
            ) : (
              <div className="space-y-3">
                {tamperLog.map((event, idx) => (
                  <div
                    key={idx}
                    className="border-l-4 pl-3 py-2"
                    style={{
                      borderColor:
                        event.severity === 'high'
                          ? '#ff4444'
                          : event.severity === 'medium'
                          ? '#ffa500'
                          : '#ffd700',
                    }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-100">{event.type}</p>
                      <p className="text-xs text-gray-500">{formatDate(event.timestamp)}</p>
                    </div>
                    <p className="text-xs text-gray-400">{event.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Scaler Recalibration Status Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-neon-cyan" />
            <h2 className="text-lg font-semibold text-gray-100">Scaler Recalibration Status</h2>
          </div>

          <div className="glass rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Last Recalibration</p>
                <p className="text-sm text-gray-100">{formatDate(scalerRecalibration.lastRecalibration)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Next Scheduled</p>
                <p className="text-sm text-gray-100">{formatDate(scalerRecalibration.nextScheduled)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Benign Samples</p>
                <p className="text-2xl font-bold text-neon-cyan">
                  {scalerRecalibration.benignSamplesInBuffer.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Drift Metric</p>
                <Gauge
                  value={scalerRecalibration.driftMetric * 100}
                  max={100}
                  size={80}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
