import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { useAppStore } from '../store/appStore';
import type { IncidentReport } from '../types';
import { DecisionLevelBadge } from '../components/SharedComponents';
import { formatDate, generateSignedUrl } from '../utils/helpers';
import { Download, DownloadCloud, Eye as EyeIcon, FileSearch } from 'lucide-react';
import { generateIncidentReportPDF } from '../utils/pdfGenerator';

export const IncidentReportsPage: React.FC = () => {
  const { reportsData } = useAppStore();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);

  const selectedReport = useMemo(() => {
    return reportsData.find(r => r.reportId === selectedReportId);
  }, [selectedReportId, reportsData]);

  const columns = useMemo<ColumnDef<IncidentReport>[]>(
    () => [
      {
        accessorKey: 'reportId',
        header: 'Report ID',
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
        accessorKey: 'ransomwareFamily',
        header: 'Ransomware Family',
        cell: (info) => {
          const family = info.getValue() as string;
          return family ? (
            <span className="text-xs font-semibold px-2 py-1 rounded bg-red-900 bg-opacity-40 text-red-300">
              {family}
            </span>
          ) : (
            <span className="text-xs text-gray-600">Unknown</span>
          );
        },
        size: 120,
      },
      {
        accessorKey: 'affectedPid',
        header: 'Affected PID',
        cell: (info) => (
          <p className="text-xs text-gray-400">{info.getValue() as React.ReactNode}</p>
        ),
        size: 80,
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: (info) => (
          <DecisionLevelBadge level={info.getValue() as any} size="sm" />
        ),
        size: 90,
      },
      {
        accessorKey: 'mitreTechniques',
        header: 'MITRE Techniques',
        cell: (info) => {
          const techniques = (info.getValue() as string[]) || [];
          return (
            <div className="flex flex-wrap gap-1">
              {techniques.slice(0, 2).map((t, i) => (
                <span key={i} className="text-xs bg-dark-700 text-gray-300 px-2 py-1 rounded">
                  {t}
                </span>
              ))}
              {techniques.length > 2 && (
                <span className="text-xs text-gray-600">+{techniques.length - 2}</span>
              )}
            </div>
          );
        },
        size: 150,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const report = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedReportId(report.reportId)}
                className="p-1 hover:bg-dark-700 rounded transition-all"
                title="View Report"
              >
                <EyeIcon size={16} className="text-neon-cyan" />
              </button>
              <button
                onClick={async () => {
                  setGeneratingLink(report.reportId);
                  generateIncidentReportPDF(report);
                  setGeneratingLink(null);
                }}
                className="p-1 hover:bg-dark-700 rounded transition-all"
                title="Download PDF"
              >
                {generatingLink === report.reportId ? (
                  <div className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download size={16} className="text-neon-cyan" />
                )}
              </button>
            </div>
          );
        },
        size: 80,
      },
    ],
    [generatingLink]
  );

  const table = useReactTable({
    data: reportsData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex-1 flex overflow-y-auto bg-dark-900">
      {/* Reports List */}
      <div className={`${selectedReport ? 'w-1/2' : 'w-full'} flex flex-col border-r border-dark-700 border-opacity-40 transition-all`}>
        <div className="flex-1 p-4 min-h-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neon-cyan mb-4">
            Incident Reports
          </h2>
          {reportsData.length > 0 ? (
            <div className="glass rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-dark-800 sticky top-0 border-b border-dark-600 border-opacity-40">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
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
                      className={`border-b border-dark-600 border-opacity-20 cursor-pointer transition-all ${
                        selectedReportId === row.original.reportId
                          ? 'bg-dark-800'
                          : 'hover:bg-dark-800 hover:bg-opacity-40'
                      }`}
                      onClick={() => setSelectedReportId(row.original.reportId)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-3 py-2"
                          style={{ width: `${cell.column.getSize()}px`, minWidth: '0px' }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center glass rounded-lg border border-dashed border-white/10">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <FileSearch className="text-gray-500" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-200 mb-2">No Reports Generated</h3>
              <p className="text-gray-500 max-w-sm text-xs leading-relaxed">
                Detailed forensic reports are generated automatically after a "Critical" threat is neutralized or a manual deep-scan is completed.
              </p>
              <div className="mt-8 px-4 py-3 bg-neon-cyan/5 rounded-xl border border-neon-cyan/10">
                <p className="text-[10px] text-neon-cyan uppercase tracking-widest font-bold">Forensic Engine: Standby</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Preview */}
      {selectedReport && (
        <div className="w-1/2 flex flex-col border-l border-dark-700 border-opacity-40">
          {/* Report Header */}
          <div className="glass border-b border-dark-700 border-opacity-40 px-6 py-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-100">{selectedReport.reportId}</h3>
                <p className="text-xs text-gray-500">{formatDate(selectedReport.timestamp)}</p>
              </div>
              <button
                onClick={() => setSelectedReportId(null)}
                className="px-3 py-1 text-xs text-gray-400 hover:text-gray-300 bg-dark-800 rounded"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-3">
              {selectedReport.ransomwareFamily && (
                <span className="text-xs font-semibold px-3 py-1 rounded bg-red-900 bg-opacity-40 text-red-300">
                  {selectedReport.ransomwareFamily}
                </span>
              )}
              <DecisionLevelBadge level={selectedReport.severity} size="sm" />
            </div>

            {/* Download Buttons */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={async () => {
                  setGeneratingLink('pdf');
                  generateIncidentReportPDF(selectedReport);
                  
                  setGeneratingLink(null);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-neon-cyan bg-opacity-20 text-neon-cyan rounded hover:bg-opacity-30 transition-all text-sm"
              >
                <Download size={14} />
                PDF
              </button>
              <button
                onClick={async () => {
                  setGeneratingLink('json');
                  const url = await generateSignedUrl(selectedReport.reportId, 'json'); window.location.href = url;
                  
                  setGeneratingLink(null);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-neon-cyan bg-opacity-20 text-neon-cyan rounded hover:bg-opacity-30 transition-all text-sm"
              >
                <Download size={14} />
                JSON
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 bg-neon-amber bg-opacity-20 text-neon-amber rounded hover:bg-opacity-30 transition-all text-sm"
                title="Requires additional security certificate"
              >
                <DownloadCloud size={14} />
                Forensic Archive
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedReport.htmlContent }}
              style={{
                color: '#e5e7eb',
              }}
            />

            {/* Forensic Artifacts */}
            {selectedReport.forensicArtifacts.length > 0 && (
              <div className="mt-6 pt-6 border-t border-dark-600">
                <h4 className="text-sm font-semibold text-neon-cyan mb-3">Forensic Artifacts</h4>
                <ul className="space-y-2">
                  {selectedReport.forensicArtifacts.map((artifact, i) => (
                    <li key={i} className="text-xs text-gray-400 font-mono">
                      {artifact}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Response Actions */}
            {selectedReport.responseActions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-dark-600">
                <h4 className="text-sm font-semibold text-neon-amber mb-3">Response Actions</h4>
                <ul className="space-y-1">
                  {selectedReport.responseActions.map((action, i) => (
                    <li key={i} className="text-xs text-gray-300">
                      • {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {selectedReport.recommendedRemediation.length > 0 && (
              <div className="mt-6 pt-6 border-t border-dark-600">
                <h4 className="text-sm font-semibold text-neon-green mb-3">Recommended Remediation</h4>
                <ul className="space-y-1">
                  {selectedReport.recommendedRemediation.map((rec, i) => (
                    <li key={i} className="text-xs text-gray-300">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
