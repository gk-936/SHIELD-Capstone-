import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { useAppStore } from '../store/appStore';
import type { Alert } from '../types';
import { DecisionLevelBadge, ProgressBar } from '../components/SharedComponents';
import { formatDate, formatDuration, downloadFile, generateCSV } from '../utils/helpers';
import { Download, Filter, X, ShieldAlert } from 'lucide-react';

export const AlertHistoryPage: React.FC = () => {
  const { alerts, setCurrentPage, setSelectedProcessPid } = useAppStore();
  const [filters, setFilters] = useState({
    decisionLevels: [] as string[],
    processName: '',
    disposition: '' as string,
  });

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (filters.decisionLevels.length > 0 && !filters.decisionLevels.includes(alert.peakLevel)) {
        return false;
      }
      if (filters.processName && !alert.processName.toLowerCase().includes(filters.processName.toLowerCase())) {
        return false;
      }
      if (filters.disposition) {
        const disposition =
          alert.outcome === 'Killed' ? 'resolved' :
          alert.outcome === 'False Positive' ? 'false-positive' :
          'active';
        if (disposition !== filters.disposition) return false;
      }
      return true;
    });
  }, [alerts, filters]);

  const columns = useMemo<ColumnDef<Alert>[]>(
    () => [
      {
        accessorKey: 'alertId',
        header: 'Alert ID',
        cell: (info) => (
          <p className="text-xs font-mono text-neon-cyan">{info.getValue() as string}</p>
        ),
        size: 120,
      },
      {
        accessorKey: 'timestamp',
        header: 'Timestamp',
        cell: (info) => (
          <p className="text-xs text-gray-500">{formatDate(info.getValue() as number)}</p>
        ),
        size: 150,
      },
      {
        accessorKey: 'pid',
        header: 'PID',
        cell: (info) => (
          <p className="text-xs font-mono text-gray-400">{info.getValue() as React.ReactNode}</p>
        ),
        size: 70,
      },
      {
        accessorKey: 'processName',
        header: 'Process Name',
        cell: (info) => (
          <p className="text-xs text-gray-100 font-semibold">{info.getValue() as string}</p>
        ),
        size: 120,
      },
      {
        accessorKey: 'peakLevel',
        header: 'Peak Level',
        cell: (info) => (
          <DecisionLevelBadge level={info.getValue() as any} size="sm" />
        ),
        size: 90,
      },
      {
        accessorKey: 'peakScore',
        header: 'Peak Score',
        cell: (info) => (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-16">
              <ProgressBar
                value={info.getValue() as number}
                min={0}
                max={1}
                height="0.3rem"
              />
            </div>
            <p className="text-xs text-gray-400 w-12 text-right">
              {((info.getValue() as number)).toFixed(3)}
            </p>
          </div>
        ),
        size: 120,
      },
      {
        accessorKey: 'duration',
        header: 'Duration',
        cell: (info) => (
          <p className="text-xs text-gray-400">{formatDuration(info.getValue() as number)}</p>
        ),
        size: 80,
      },
      {
        accessorKey: 'outcome',
        header: 'Outcome',
        cell: (info) => {
          const outcome = info.getValue() as string;
          const colors: Record<string, string> = {
            'Killed': '#ff4444',
            'False Positive': '#ffd700',
            'Resolved': '#00ff41',
            'Active': '#ffa500',
          };
          return (
            <span
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                backgroundColor: `${colors[outcome] || '#00d9ff'}20`,
                color: colors[outcome] || '#00d9ff',
              }}
            >
              {outcome}
            </span>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'reportAvailable',
        header: 'Report',
        cell: (info) => (
          info.getValue() ? (
            <Download size={16} className="text-neon-cyan cursor-pointer hover:text-neon-cyan" />
          ) : (
            <span className="text-xs text-gray-600">—</span>
          )
        ),
        size: 60,
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredAlerts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleExportCSV = () => {
    const headers = ['Alert ID', 'Timestamp', 'PID', 'Process', 'Peak Level', 'Peak Score', 'Duration', 'Outcome'];
    const data = filteredAlerts.map(alert => [
      alert.alertId,
      formatDate(alert.timestamp),
      alert.pid,
      alert.processName,
      alert.peakLevel,
      alert.peakScore.toFixed(3),
      formatDuration(alert.duration),
      alert.outcome,
    ]);
    const csv = generateCSV(headers, data);
    downloadFile(csv, `alert-history-${Date.now()}.csv`, 'text/csv');
  };

  const toggleDecisionLevel = (level: string) => {
    setFilters(prev => ({
      ...prev,
      decisionLevels: prev.decisionLevels.includes(level)
        ? prev.decisionLevels.filter(l => l !== level)
        : [...prev.decisionLevels, level],
    }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-dark-900">
      {/* Filters Bar */}
      <div className="glass border-b border-dark-700 border-opacity-40 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4 mb-3">
          <Filter size={18} className="text-neon-cyan" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Filters</h2>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {/* Decision Level Filter */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Decision Level</p>
            <div className="space-y-1">
              {['MEDIUM', 'HIGH', 'CONFIRMED'].map(level => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.decisionLevels.includes(level)}
                    onChange={() => toggleDecisionLevel(level)}
                    className="w-4 h-4 rounded border-gray-600 text-neon-cyan focus:ring-neon-cyan"
                  />
                  <span className="text-xs text-gray-400">{level}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Process Name Filter */}
          <div>
            <label className="text-xs text-gray-500 block mb-2">Process Name</label>
            <input
              type="text"
              placeholder="Search..."
              value={filters.processName}
              onChange={(e) => setFilters(prev => ({ ...prev, processName: e.target.value }))}
              className="alert-input w-full text-sm"
            />
          </div>

          {/* Disposition Filter */}
          <div>
            <label className="text-xs text-gray-500 block mb-2">Disposition</label>
            <select
              value={filters.disposition}
              onChange={(e) => setFilters(prev => ({ ...prev, disposition: e.target.value }))}
              className="alert-input w-full text-sm"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="false-positive">False Positive</option>
            </select>
          </div>

          {/* Export Button */}
          <div className="flex items-end">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-neon-cyan bg-opacity-20 text-neon-cyan rounded hover:bg-opacity-30 transition-all text-sm"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            {(filters.processName || filters.decisionLevels.length > 0 || filters.disposition) && (
              <button
                onClick={() => setFilters({ decisionLevels: [], processName: '', disposition: '' })}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-300 text-sm"
              >
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        <div className="glass rounded-lg flex flex-col">
          {filteredAlerts.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-dark-800 sticky top-0 border-b border-dark-600 border-opacity-40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                        style={{ width: `${header.getSize()}px` }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-dark-600 border-opacity-20 hover:bg-dark-800 hover:bg-opacity-40 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedProcessPid(row.original.pid);
                      setCurrentPage('process-detail');
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3"
                        style={{ width: `${cell.column.getSize()}px` }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-neon-cyan/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <ShieldAlert className="text-neon-cyan" size={40} />
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Systems Secure</h3>
              <p className="text-gray-400 max-w-sm text-sm">
                No behavioral anomalies or ransomware signatures have been detected in the current monitoring window.
              </p>
              <div className="mt-8 flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_8px_#10b981]" /> eBPF Sensors Active</span>
                <span className="w-px h-3 bg-white/10" />
                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_8px_#10b981]" /> AI Engine Operational</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
