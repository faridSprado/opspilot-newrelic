import { ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatMetric } from '@/lib/utils';

export function MetricCard({ label, value, unit, hint }: { label: string; value?: number; unit?: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="metric-number mt-3 text-3xl font-semibold tracking-tight text-white">{formatMetric(value, unit)}</p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200"><ArrowUpRight className="h-4 w-4" /></div>
      </div>
      {hint && <p className="mt-4 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
