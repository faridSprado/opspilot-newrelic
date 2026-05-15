'use client';

import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { cn } from '@/lib/utils';
import { describeTimeRangeSelection, formatForDatetimeLocal } from '@/lib/time';

const ranges = [
  { value: '30', label: '30 min', minutes: 30 },
  { value: '60', label: '1 h', minutes: 60 },
  { value: '180', label: '3 h', minutes: 180 },
  { value: '1440', label: '24 h', minutes: 1440 },
  { value: '10080', label: '7 d', minutes: 10080 },
  { value: 'custom', label: 'Personalizado' }
];

function defaultLocalDateTime(minutesBack: number) {
  return formatForDatetimeLocal(new Date(Date.now() - minutesBack * 60_000));
}

export function TimeRangePicker() {
  const timeRange = useWorkspaceStore((state) => state.timeRange);
  const timeRangeSelection = useWorkspaceStore((state) => state.timeRangeSelection);
  const setPresetTimeRange = useWorkspaceStore((state) => state.setPresetTimeRange);
  const setCustomTimeRange = useWorkspaceStore((state) => state.setCustomTimeRange);
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(timeRangeSelection.kind === 'preset' ? timeRangeSelection.value : 'custom');
  const [from, setFrom] = useState(timeRangeSelection.kind === 'custom' ? timeRangeSelection.fromLocal : defaultLocalDateTime(180));
  const [to, setTo] = useState(timeRangeSelection.kind === 'custom' ? timeRangeSelection.toLocal : defaultLocalDateTime(0));
  const selected = timeRangeSelection.kind === 'custom' ? 'custom' : selectedPreset;
  const stepLabel = timeRange.step?.replace('minutes', 'min').replace('minute', 'min').replace('hours', 'h').replace('hour', 'h').replace('days', 'd').replace('day', 'd') ?? 'auto';
  const rangeLabel = describeTimeRangeSelection(timeRangeSelection);

  function applyPreset(value: string) {
    setSelectedPreset(value);
    if (value === 'custom') {
      setOpen(true);
      return;
    }
    const range = ranges.find((item) => item.value === value && typeof item.minutes === 'number') as { value: string; label: string; minutes: number } | undefined;
    if (!range) return;
    setPresetTimeRange(range.minutes, range.value, range.label);
    setOpen(false);
  }

  function applyCustom() {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate >= toDate) return;
    setCustomTimeRange(from, to, 'Personalizado');
    setSelectedPreset('custom');
    setOpen(false);
  }

  return (
    <div className="relative flex items-center gap-2">
      <select value={selected} onChange={(event) => applyPreset(event.target.value)} className="focus-ring h-9 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-slate-200 dark:bg-slate-950" aria-label="Rango de tiempo">
        {ranges.map(range => <option key={range.value} value={range.value}>{range.label}</option>)}
      </select>
      <button type="button" onClick={() => setOpen(!open)} className={cn('focus-ring hidden h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/[.06] sm:flex', open && 'border-emerald-300/30 text-emerald-100')}>
        <CalendarClock className="h-4 w-4" /> {rangeLabel} · UTC · {stepLabel}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[22rem] rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-premium backdrop-blur-xl">
          <p className="text-sm font-medium text-white">Rango personalizado</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">El selector usa tu hora local, pero la consulta se envía a New Relic en UTC. Los segundos siempre se fijan en 00 y los límites se redondean hacia abajo al múltiplo de 5 minutos anterior.</p>
          <div className="mt-4 space-y-3">
            <label className="block space-y-2 text-xs text-slate-300">Desde<input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} className="focus-ring h-10 w-full rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm text-white" /></label>
            <label className="block space-y-2 text-xs text-slate-300">Hasta<input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} className="focus-ring h-10 w-full rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm text-white" /></label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" variant="primary" onClick={applyCustom}>Aplicar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
