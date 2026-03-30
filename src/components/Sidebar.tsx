import React from 'react';
import { useAppStore } from '../store/appStore';
import { Shield, Activity, AlertTriangle, FileText, Settings, Clock } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, connectionStatus } = useAppStore();

  const pages = [
    { id: 'overview', label: 'Live Threats', icon: Activity },
    { id: 'process-detail', label: 'Process Detail', icon: AlertTriangle },
    { id: 'alert-history', label: 'Alerts', icon: Clock },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'system-health', label: 'Health', icon: Settings },
  ] as const;

  return (
    <div className="w-[80px] bg-[#050810]/95 backdrop-blur-2xl border-r border-white/5 flex flex-col h-screen shrink-0 items-center py-6 z-50">
      {/* Logo */}
      <div className="mb-10 w-12 h-12 bg-gradient-to-br from-neon-cyan/20 to-neon-amber/20 rounded-xl border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
        <Shield size={22} className="text-neon-cyan" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 w-full space-y-4 flex flex-col items-center">
        {pages.map((page) => {
          const Icon = page.icon;
          const isActive = currentPage === page.id;
          return (
            <button
              key={page.id}
              onClick={() => setCurrentPage(page.id)}
              title={page.label}
              className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-200 border border-transparent'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
            </button>
          );
        })}
      </nav>

      {/* Connection Status */}
      <div className="mt-auto pt-6 flex flex-col items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            connectionStatus.connected ? 'bg-neon-cyan shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-pulse' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
          }`}
          title={connectionStatus.connected ? 'Connected' : 'Disconnected'}
        />
      </div>
    </div>
  );
};
