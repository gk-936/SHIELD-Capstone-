import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store/appStore';
import type { ProcessInfo } from '../types';

interface CouncilRadarChartProps {
  pid?: number;
}

export const CouncilRadarChart: React.FC<CouncilRadarChartProps> = ({ pid }) => {
  const { processes } = useAppStore();

  const data = useMemo(() => {
    const process = processes.find(p => p.pid === pid);
    if (!process || !process.radarScores) return [
      { model: 'IF_storage', score: 0 },
      { model: 'IF_memory', score: 0 },
      { model: 'IF_full', score: 0 },
      { model: 'HBOS', score: 0 },
      { model: 'LOF', score: 0 },
      { model: 'IF_diverse', score: 0 },
    ];

    const s = process.radarScores;
    // s[0-5] mapped to the 6 models
    return [
      { model: 'IF_storage', score: (s[0] || 0) * 100 },
      { model: 'IF_memory', score: (s[1] || 0) * 100 },
      { model: 'IF_full', score: (s[2] || 0) * 100 },
      { model: 'HBOS', score: (s[3] || 0) * 100 },
      { model: 'LOF', score: (s[4] || 0) * 100 },
      { model: 'IF_diverse', score: (s[5] || 0) * 100 },
    ];
  }, [pid, processes]);

  if (!pid) {
    return (
      <div className="glass rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">Select a process to view council model scores</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4 h-full">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neon-cyan mb-4">
        Council Model Scores
      </h3>
      <div style={{ height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 20, right: 80, left: 80, bottom: 20 }}>
            <PolarGrid stroke="#1a2332" />
            <PolarAngleAxis
              dataKey="model"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
            />
            <Radar
              name="Anomaly Score"
              dataKey="score"
              stroke="#00d9ff"
              fill="#00d9ff"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
