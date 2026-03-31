import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store/appStore';

export const SlidingWindowRankChart: React.FC = () => {
  const { selectedProcessPid, globalRankHistory } = useAppStore();

  const chartData = useMemo(() => {
    // If no live data yet, show empty or placeholder
    if (globalRankHistory.length === 0) return [];
    
    return globalRankHistory;
  }, [globalRankHistory]);

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 h-full flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-5 bg-neon-cyan rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">
          Rank Score History
        </h2>
        <span className="ml-auto text-xs font-mono bg-white/5 text-gray-300 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
          {selectedProcessPid ? `PID: ${selectedProcessPid}` : 'GLOBAL AVERAGE'}
        </span>
      </div>

      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke="#475569"
              fontSize={10}
              tick={{ fill: '#64748b' }}
              tickMargin={10}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              stroke="#475569"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              fontSize={10}
              tick={{ fill: '#64748b' }}
              tickFormatter={(val) => val.toFixed(2)}
            />

            <ReferenceLine
              y={0.5}
              stroke="#eab308"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: 'MED (0.5)',
                position: 'insideTopLeft',
                fill: '#eab308',
                fontSize: 9,
                opacity: 0.8
              }}
            />
            <ReferenceLine
              y={0.7}
              stroke="#f97316"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: 'HIGH (0.7)',
                position: 'insideTopLeft',
                fill: '#f97316',
                fontSize: 9,
                opacity: 0.8
              }}
            />
            <ReferenceLine
              y={0.9}
              stroke="#ef4444"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: 'CRIT (0.9)',
                position: 'insideTopLeft',
                fill: '#ef4444',
                fontSize: 9,
                opacity: 0.8
              }}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#080d1a',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
              }}
              itemStyle={{ color: '#06b6d4', fontSize: '12px', fontWeight: 'bold' }}
              labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
              formatter={(value) => [`${(value as number).toFixed(3)}`, 'Score']}
            />

            <Area
              type="monotone"
              dataKey="score"
              stroke="#06b6d4"
              fillOpacity={1}
              fill="url(#cyanGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
