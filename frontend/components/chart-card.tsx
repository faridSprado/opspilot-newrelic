'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChartToolbar } from '@/components/chart-toolbar';
import { NRQLEditor } from '@/components/nrql-editor';
import { RawDataTable } from '@/components/raw-data-table';
import { UniversalChart } from '@/charts/universal-chart';
import type { ChartSpec } from '@/types';

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[.04] dark:text-white">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/10 p-3">{children}</div>
    </details>
  );
}

export function ChartCard({ spec }: { spec: ChartSpec }) {
  const [downloadPng, setDownloadPng] = useState<(() => void) | undefined>();
  const nrql = typeof spec.meta.nrql === 'string' ? spec.meta.nrql : null;
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{spec.title}</h3>
          {spec.subtitle && <p className="mt-1 text-sm text-slate-400">{spec.subtitle}</p>}
          {spec.meta?.excluded_y_columns?.length ? <p className="mt-2 text-xs text-emerald-200">Columnas excluidas del eje Y: {spec.meta.excluded_y_columns.join(', ')}</p> : null}
          {spec.meta?.time_basis === 'UTC' ? <p className="mt-1 text-xs text-emerald-200">Horario de la gráfica: UTC</p> : null}
        </div>
        <ChartToolbar spec={spec} onDownloadPng={downloadPng} />
      </CardHeader>
      <CardContent className="space-y-5">
        {spec.type !== 'table' && <UniversalChart spec={spec} onPngReady={(fn) => setDownloadPng(() => fn)} />}
        {nrql ? (
          <CollapsibleSection title="NRQL">
            <NRQLEditor value={nrql} compact />
          </CollapsibleSection>
        ) : null}
        <CollapsibleSection title={`Datos crudos · ${spec.rows.length} filas`}>
          <RawDataTable rows={spec.rows} compact />
        </CollapsibleSection>
      </CardContent>
    </Card>
  );
}
