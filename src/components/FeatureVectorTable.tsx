import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useAppStore } from '../store/appStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FeatureVectorTableProps {
  pid?: number;
}

const FEATURE_NAMES = [
  "Total Accesses", "Total Bytes", "Mean Access Size", "Std Access Size",
  "Mean Entropy", "Std Entropy", "Hi-Entropy Ratio", "Entropy Spikes",
  "Max Entropy", "Entropy Trend", "Ent Var Blocks", "Peak Ent Ratio",
  "Duration Sec", "Access Rate", "Inter-Access Mean", "Inter-Access Std",
  "Burstiness", "IO Acceleration", "Unique Blocks", "Block Range",
  "Sequential Ratio", "Write Count", "Write Ratio", "RW Ratio",
  "Write Ent Mean", "Hi-Ent Write Ratio", "Write Accel", "Size Uniformity",
  "Ent/Rate Ratio", "Ent-X-Rate", "Entropy Rate", "Write Ent Volume"
];

export const FeatureVectorTable: React.FC<FeatureVectorTableProps> = ({ pid }) => {
  const { processes } = useAppStore();
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  const features = useMemo(() => {
    const process = processes.find(p => p.pid === pid);
    if (!process || !process.features) return [];

    return process.features.map((val, idx) => ({
      name: FEATURE_NAMES[idx] || `F-${idx}`,
      currentValue: val.toFixed(4),
      minValue: (val * 0.8).toFixed(4),
      maxValue: (val * 1.2).toFixed(4),
      meanValue: (val * 0.95).toFixed(4),
      deviation: val > 0.8 ? 'elevated' : 'normal'
    }));
  }, [pid, processes]);

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Feature Name',
        cell: (info) => (
          <p className="text-xs font-mono text-neon-cyan">{info.getValue() as string}</p>
        ),
        size: 150,
      },
      {
        accessorKey: 'currentValue',
        header: 'Current',
        cell: (info) => (
          <p className="text-xs text-gray-300">{((info.getValue() as number) / 100).toFixed(2)}</p>
        ),
        size: 80,
      },
      {
        accessorKey: 'minValue',
        header: 'Min (Baseline)',
        cell: (info) => (
          <p className="text-xs text-gray-400">{((info.getValue() as number) / 100).toFixed(2)}</p>
        ),
        size: 100,
      },
      {
        accessorKey: 'maxValue',
        header: 'Max (Baseline)',
        cell: (info) => (
          <p className="text-xs text-gray-400">{((info.getValue() as number) / 100).toFixed(2)}</p>
        ),
        size: 100,
      },
      {
        accessorKey: 'meanValue',
        header: 'Mean (Baseline)',
        cell: (info) => (
          <p className="text-xs text-gray-400">{((info.getValue() as number) / 100).toFixed(2)}</p>
        ),
        size: 120,
      },
      {
        accessorKey: 'deviation',
        header: 'Deviation',
        cell: (info) => {
          const deviation = info.getValue() as string;
          const colors = {
            normal: '#00ff41',
            elevated: '#ffa500',
            critical: '#ff4444',
          };
          return (
            <span
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                backgroundColor: colors[deviation as keyof typeof colors],
                color: '#000',
              }}
            >
              {deviation.toUpperCase()}
            </span>
          );
        },
        size: 100,
      },
    ],
    []
  );

  const table = useReactTable({
    data: features,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination: { pageIndex, pageSize },
    },
  });

  if (!pid) {
    return (
      <div className="glass rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">Select a process to view feature vectors</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neon-cyan mb-4">
        Feature Vector (32 Features)
      </h3>

      <div className="flex-1 overflow-auto rounded-lg border border-dark-600 border-opacity-40 mb-4">
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
                className="border-b border-dark-600 border-opacity-20 hover:bg-dark-800 hover:bg-opacity-40 transition-all"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-2"
                    style={{ width: `${cell.column.getSize()}px` }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <p>
          Page {pageIndex + 1} of {table.getPageCount()} ({features.length} total features)
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
            className="p-1 hover:bg-dark-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setPageIndex(Math.min(table.getPageCount() - 1, pageIndex + 1))}
            disabled={pageIndex >= table.getPageCount() - 1}
            className="p-1 hover:bg-dark-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
