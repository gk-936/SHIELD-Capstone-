import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { generateEBPFEvents } from '../mock/generators';
import type { eBPFEvent } from '../types';
import { getEntropyColor, formatBytes } from '../utils/helpers';
import { HardDrive } from 'lucide-react';

interface IOEventTimelineProps {
  pid?: number;
}

export const IOEventTimeline: React.FC<IOEventTimelineProps> = ({ pid }) => {
  const events = useMemo(() => {
    if (!pid) return [];
    return generateEBPFEvents(1000);
  }, [pid]);

  const columns = useMemo<ColumnDef<eBPFEvent>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: 'Timestamp',
        cell: (info) => (
          <p className="text-xs font-mono text-gray-500">
            {new Date(info.getValue() as number).toLocaleTimeString()}
          </p>
        ),
        size: 100,
      },
      {
        accessorKey: 'operation',
        header: 'Operation',
        cell: (info) => {
          const op = info.getValue() as string;
          const colors: Record<string, string> = {
            read: '#00d9ff',
            write: '#ff4444',
            rename: '#ffa500',
            unlink: '#ff4444',
          };
          return (
            <span
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                backgroundColor: `${colors[op]}20`,
                color: colors[op],
              }}
            >
              {op.toUpperCase()}
            </span>
          );
        },
        size: 80,
      },
      {
        accessorKey: 'lba',
        header: 'LBA',
        cell: (info) => (
          <p className="text-xs text-gray-400">{((info.getValue() as number) / 1000).toFixed(2)}K</p>
        ),
        size: 70,
      },
      {
        accessorKey: 'gpa',
        header: 'GPA',
        cell: (info) => (
          <p className="text-xs text-gray-400">{((info.getValue() as number) / 1000).toFixed(2)}K</p>
        ),
        size: 70,
      },
      {
        accessorKey: 'size',
        header: 'Size',
        cell: (info) => (
          <p className="text-xs text-gray-400">{formatBytes(info.getValue() as number)}</p>
        ),
        size: 80,
      },
      {
        accessorKey: 'entropy',
        header: 'Entropy',
        cell: (info) => {
          const entropy = info.getValue() as number;
          const color = getEntropyColor(entropy);
          return (
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: color }}
              />
              <p className="text-xs text-gray-400">{entropy.toFixed(2)}</p>
            </div>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'pid',
        header: 'PID',
        cell: (info) => (
          <p className="text-xs font-mono text-gray-500">{info.getValue() as React.ReactNode}</p>
        ),
        size: 60,
      },
    ],
    []
  );

  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!pid) {
    return (
      <div className="glass rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">Select a process to view I/O events</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <HardDrive size={16} className="text-neon-cyan" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neon-cyan">
          I/O Event Timeline (Last 1000 Events)
        </h3>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-dark-600 border-opacity-40">
        <table className="w-full text-sm">
          <thead className="bg-dark-800 sticky top-0 border-b border-dark-600 border-opacity-40">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap"
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
                    className="px-3 py-2 whitespace-nowrap"
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
    </div>
  );
};
