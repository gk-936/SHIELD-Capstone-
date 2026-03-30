import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { generateCouncilScores } from '../mock/generators';

interface CouncilRadarChartProps {
  pid?: number;
}

export const CouncilRadarChart: React.FC<CouncilRadarChartProps> = ({ pid }) => {
  const data = useMemo(() => {
    const scores = generateCouncilScores();
    return [
      { model: 'IF_storage', score: scores.IF_storage * 100 },
      { model: 'IF_memory', score: scores.IF_memory * 100 },
      { model: 'IF_full', score: scores.IF_full * 100 },
      { model: 'HBOS', score: scores.HBOS * 100 },
      { model: 'LOF', score: scores.LOF * 100 },
      { model: 'IF_diverse', score: scores.IF_diverse * 100 },
    ];
  }, [pid]);

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
