'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';
import { APMCard } from '@/components/apm-card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { Button } from '@/components/ui/button';
import { severityTone } from '@/components/health-badge';
import type { EntitySummary } from '@/types';

type EntityListResponse = { ok: boolean; entities: EntitySummary[] };
type StatusFilter = 'all' | 'active' | 'inactive' | 'critical' | 'warning' | 'healthy' | 'unknown';

const filters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
  { value: 'critical', label: 'Críticas' },
  { value: 'warning', label: 'Con advertencia' },
  { value: 'healthy', label: 'Sin alertas' },
  { value: 'unknown', label: 'Sin estado' }
];

function matchesStatus(entity: EntitySummary, status: StatusFilter) {
  if (status === 'all') return true;
  if (status === 'active') return entity.reporting === true;
  if (status === 'inactive') return entity.reporting === false;
  const tone = severityTone(entity.alert_severity ?? entity.health_status);
  if (status === 'healthy') return tone === 'healthy';
  if (status === 'unknown') return tone === 'unknown' || tone === 'unconfigured';
  return tone === status;
}

export function APMList() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['apms'], queryFn: () => apiGet<EntityListResponse>('/api/entities/apm') });
  const entities = data?.entities ?? [];
  const filtered = useMemo(() => {
    const text = query.toLowerCase().trim();
    return entities.filter(entity => {
      const searchable = [entity.name, entity.language, entity.domain, entity.type].filter(Boolean).join(' ').toLowerCase();
      return (!text || searchable.includes(text)) && matchesStatus(entity, status);
    });
  }, [entities, query, status]);

  const counts = useMemo(() => ({
    total: entities.length,
    active: entities.filter(entity => entity.reporting === true).length,
    inactive: entities.filter(entity => entity.reporting === false).length,
    critical: entities.filter(entity => severityTone(entity.alert_severity ?? entity.health_status) === 'critical').length,
    warning: entities.filter(entity => severityTone(entity.alert_severity ?? entity.health_status) === 'warning').length,
  }), [entities]);

  if (isLoading) return <LoadingSkeleton lines={7} />;
  if (error) return <ErrorState body={(error as Error).message} onRetry={() => refetch()} />;
  if (!entities.length) return <EmptyState title="No hay APMs accesibles" body="La conexión está activa, pero New Relic no devolvió aplicaciones APM. Revisa que tu clave tenga acceso, que la región sea correcta y que las aplicaciones estén enviando datos." action={<a href="/settings"><Button variant="primary">Revisar sesión</Button></a>} />;
  return (
    <div>
      <div className="mb-5 grid gap-3 rounded-3xl border border-white/10 bg-white/[.03] p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, lenguaje o tipo…" className="focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[.04] px-4 text-sm text-white placeholder:text-slate-500" />
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="focus-ring h-11 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-slate-200" aria-label="Filtrar APMs por estado">
          {filters.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
        </select>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1">{filtered.length} de {counts.total} APMs</span>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">{counts.active} activas</span>
        <span className="rounded-full border border-slate-300/20 bg-slate-400/10 px-3 py-1">{counts.inactive} inactivas</span>
        <span className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1 text-red-200">{counts.critical} críticas</span>
        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-200">{counts.warning} advertencias</span>
      </div>
      {!filtered.length ? <EmptyState title="Sin resultados para el filtro" body="Prueba cambiar el estado seleccionado o limpiar el texto de búsqueda." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(entity => <APMCard key={entity.guid} entity={entity} />)}
        </div>
      )}
    </div>
  );
}
