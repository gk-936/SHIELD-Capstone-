import React from 'react';
import { SystemStatusBar } from '../components/SystemStatusBar';
import { ActiveAlertsPanel } from '../components/ActiveAlertsPanel';
import { TopProcessesTable } from '../components/TopProcessesTable';
import { SlidingWindowRankChart } from '../components/SlidingWindowRankChart';  
import { GlobalEntropyHeatmap } from '../components/GlobalEntropyHeatmap';      

export const LiveThreatOverviewPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-[#03050a] overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#081225] via-[#03050a] to-[#03050a]">
      <SystemStatusBar />

      <div className="flex-1 overflow-y-auto p-8 space-y-8">

        {/* Row 1: Bento Grid */}
        <div className="flex gap-8 h-[450px]">
          <div className="w-[30%] min-w-0">
            <ActiveAlertsPanel />
          </div>
          <div className="w-[45%] min-w-0">
            <TopProcessesTable />
          </div>
          <div className="w-[25%] min-w-0">
            <GlobalEntropyHeatmap />
          </div>
        </div>

        {/* Row 2: Full Width Chart spanning bottom third */}
        <div className="w-full h-[320px] min-w-0">
          <SlidingWindowRankChart />
        </div>

      </div>
    </div>
  );
};
