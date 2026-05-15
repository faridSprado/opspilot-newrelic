'use client';

import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ChartSpec } from '@/types';
import { downloadTextFile, rowsToCsv } from '@/lib/utils';

export function ChartToolbar({ spec, onDownloadPng }: { spec: ChartSpec; onDownloadPng?: () => void }) {
  const nrql = typeof spec.meta?.nrql === 'string' ? spec.meta.nrql : '';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {nrql && <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(nrql); toast.success('NRQL copiado'); }}><Copy className="h-4 w-4" /> NRQL</Button>}
      <Button size="sm" variant="ghost" onClick={() => downloadTextFile(`${spec.title}.csv`, rowsToCsv(spec.rows), 'text/csv;charset=utf-8')}><Download className="h-4 w-4" /> CSV</Button>
      <Button size="sm" variant="ghost" onClick={onDownloadPng} disabled={!onDownloadPng}><Download className="h-4 w-4" /> PNG</Button>
    </div>
  );
}
