import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { Sidebar } from './components/Sidebar';
import { LiveThreatOverviewPage } from './pages/LiveThreatOverviewPage';
import { ProcessDetailPage } from './pages/ProcessDetailPage';
import { AlertHistoryPage } from './pages/AlertHistoryPage';
import { IncidentReportsPage } from './pages/IncidentReportsPage';
import { SystemHealthPage } from './pages/SystemHealthPage';

function App() {
  const { currentPage } = useAppStore();

  // Initialize WebSocket simulation on mount
  useEffect(() => {
    // WebSocket simulation is already handled in the store with setInterval
    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentPage === 'overview' && <LiveThreatOverviewPage />}
        {currentPage === 'process-detail' && <ProcessDetailPage />}
        {currentPage === 'alert-history' && <AlertHistoryPage />}
        {currentPage === 'reports' && <IncidentReportsPage />}
        {currentPage === 'system-health' && <SystemHealthPage />}
      </div>
    </div>
  );
}

export default App;
