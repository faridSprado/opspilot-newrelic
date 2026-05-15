'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { displayValue, downloadTextFile, rowsToCsv } from '@/lib/utils';

export function RawDataTable({ rows, compact = false }: { rows: Array<Record<string, unknown>>; compact?: boolean }) {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  if (!rows.length) return <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 text-sm text-slate-500">No hay datos crudos para este resultado.</div>;
  return (
    <div className={compact ? 'overflow-hidden rounded-xl border border-white/10' : 'overflow-hidden rounded-2xl border border-white/10'}>
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[.03] px-4 py-3">
        {!compact ? <p className="text-sm font-medium text-white">Datos crudos · {rows.length} filas</p> : <span />}
        <Button size="sm" variant="ghost" onClick={() => downloadTextFile('new-relic-data.csv', rowsToCsv(rows), 'text/csv;charset=utf-8')}><Download className="h-4 w-4" /> CSV</Button>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-950 text-slate-400">
            <tr>{columns.map(col => <th key={col} className="whitespace-nowrap border-b border-white/10 px-4 py-3 font-medium">{col}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 1000).map((row, idx) => <tr key={idx} className="border-b border-white/[.06] text-slate-300 odd:bg-white/[.015]">{columns.map(col => <td key={col} className="whitespace-nowrap px-4 py-3 font-mono">{displayValue(row[col])}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
