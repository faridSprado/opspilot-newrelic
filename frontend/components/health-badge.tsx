import { cn } from '@/lib/utils';

function normalizeSeverity(severity?: string | null) {
  return (severity ?? 'unknown').toString().trim().toLowerCase().replace(/[_-]/g, ' ');
}

export function severityLabel(severity?: string | null) {
  const value = normalizeSeverity(severity);
  if (value.includes('critical') || value.includes('crítico') || value.includes('critico')) return 'Crítico';
  if (value.includes('warning') || value.includes('warn') || value.includes('advertencia')) return 'Advertencia';
  if (value.includes('not alerting') || value.includes('healthy') || value.includes('ok')) return 'Sin alertas';
  if (value.includes('not configured')) return 'Sin política';
  if (value.includes('unknown') || value === '') return 'Sin estado';
  return severity ?? 'Sin estado';
}

export function severityTone(severity?: string | null) {
  const value = normalizeSeverity(severity);
  if (value.includes('critical') || value.includes('crítico') || value.includes('critico')) return 'critical';
  if (value.includes('warning') || value.includes('warn') || value.includes('advertencia')) return 'warning';
  if (value.includes('not alerting') || value.includes('healthy') || value.includes('ok')) return 'healthy';
  if (value.includes('not configured')) return 'unconfigured';
  return 'unknown';
}

export function HealthBadge({ severity }: { severity?: string | null }) {
  const tone = severityTone(severity);
  const cls = tone === 'critical'
    ? 'bg-red-400/10 text-red-200 border-red-300/20'
    : tone === 'warning'
      ? 'bg-amber-400/10 text-amber-200 border-amber-300/20'
      : tone === 'healthy'
        ? 'bg-emerald-400/10 text-emerald-200 border-emerald-300/20'
        : 'bg-slate-400/10 text-slate-300 border-slate-300/20';
  return <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-medium', cls)}>{severityLabel(severity)}</span>;
}
