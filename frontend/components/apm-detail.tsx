'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiGet, apiPostAllowFalse } from '@/lib/api';
import type { ChatResponse, EntitySummary } from '@/types';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ChartCard } from '@/components/chart-card';
import { ErrorState } from '@/components/error-state';
import { HealthBadge } from '@/components/health-badge';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type EntityDetailResponse = { ok: boolean; entity: EntitySummary };

export function APMDetail({ guid }: { guid: string }) {
  const { accountId, timeRange, setSelectedEntity } = useWorkspaceStore();
  const entityQuery = useQuery({ queryKey: ['entity', guid], queryFn: () => apiGet<EntityDetailResponse>(`/api/entities/${encodeURIComponent(guid)}`) });
  useEffect(() => { if (entityQuery.data?.entity) {
      setSelectedEntity(entityQuery.data.entity);
      if (!accountId && entityQuery.data.entity.account_id) useWorkspaceStore.getState().setAccountId(entityQuery.data.entity.account_id);
    } }, [entityQuery.data?.entity, setSelectedEntity, accountId]);
  const metricsQuery = useQuery({
    queryKey: ['golden', guid, accountId, timeRange.since, timeRange.until],
    enabled: Boolean(accountId),
    queryFn: () => apiPostAllowFalse<ChatResponse>('/api/chat', { message: 'Grafica throughput y response time para el rango seleccionado', account_id: accountId, entity_guid: guid, entity_name: entityQuery.data?.entity.name, transaction_event_type: entityQuery.data?.entity.transaction_event_type ?? 'Transaction', transaction_name_attribute: entityQuery.data?.entity.transaction_name_attribute ?? 'name', time_range: timeRange })
  });
  if (entityQuery.isLoading) return <LoadingSkeleton lines={6} />;
  if (entityQuery.error) return <ErrorState body={(entityQuery.error as Error).message} onRetry={() => entityQuery.refetch()} />;
  const entity = entityQuery.data?.entity;
  if (!entity) return null;
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Detalle APM</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{entity.name}</h1>
            <p className="mt-3 text-slate-400">{entity.domain} · {entity.type} · {entity.language ?? 'lenguaje no detectado'}</p>
          </div>
          <div className="flex items-center gap-3"><HealthBadge severity={entity.alert_severity} />{entity.permalink && <a href={entity.permalink} target="_blank" rel="noreferrer"><Button>Abrir en New Relic</Button></a>}</div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Base temporal</p>
          <p className="mt-2 text-lg font-semibold text-white">Horario UTC</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Las gráficas y tooltips se muestran en UTC para alinear la lectura con New Relic y evitar desfases por hora local del navegador.</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Evento principal</p>
          <p className="mt-2 text-lg font-semibold text-white">{entity.transaction_event_type ?? 'Transaction'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Atributo de transacción: {entity.transaction_name_attribute ?? 'name'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Fuentes detectadas</p>
          <p className="mt-2 text-lg font-semibold text-white">{entity.data_sources?.length ? `${entity.data_sources.length} disponibles` : 'Validando con New Relic'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{entity.data_sources?.length ? entity.data_sources.map(source => `${source.event_type}: ${source.count}`).join(' · ') : 'Se usa Transaction por defecto si no hay metadatos adicionales.'}</p>
        </Card>
      </div>
      {!accountId && <ErrorState title="Selecciona una cuenta" body="Selecciona una cuenta para consultar el detalle en New Relic." />}
      {metricsQuery.isLoading && <LoadingSkeleton lines={4} />}
      {metricsQuery.error && <ErrorState body={(metricsQuery.error as Error).message} onRetry={() => metricsQuery.refetch()} />}
      {metricsQuery.data?.ok === false && <ErrorState title="New Relic no devolvió una gráfica para este rango" body={metricsQuery.data.answer || 'La consulta se ejecutó, pero no hubo datos visualizables. Prueba ampliar el rango o revisar el tipo de evento detectado.'} onRetry={() => metricsQuery.refetch()} />}
      {metricsQuery.data?.visualizations.map(spec => <ChartCard key={spec.id} spec={spec} />)}
    </div>
  );
}
