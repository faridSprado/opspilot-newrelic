'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, Bot, Gauge, RadioTower } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { HealthBadge } from '@/components/health-badge';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { MetricCard } from '@/components/metric-card';
import type { AccountSummary, EntitySummary } from '@/types';

type AccountsResponse = { ok: boolean; accounts: AccountSummary[] };
type EntityListResponse = { ok: boolean; entities: EntitySummary[] };

function severityRank(severity?: string | null) {
  const value = (severity || '').toLowerCase();
  if (value.includes('critical')) return 0;
  if (value.includes('warning')) return 1;
  if (value.includes('healthy')) return 3;
  return 2;
}

export function DashboardOverview() {
  const accountId = useWorkspaceStore((state) => state.accountId);
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => apiGet<AccountsResponse>('/api/accounts') });
  const apmQuery = useQuery({ queryKey: ['apms'], queryFn: () => apiGet<EntityListResponse>('/api/entities/apm') });
  const accounts = accountsQuery.data?.accounts ?? [];
  const apms = apmQuery.data?.entities ?? [];
  const visibleApms = accountId ? apms.filter((entity) => entity.account_id === accountId) : apms;
  const critical = visibleApms.filter((entity) => (entity.alert_severity || '').toLowerCase().includes('critical')).length;
  const warning = visibleApms.filter((entity) => (entity.alert_severity || '').toLowerCase().includes('warning')).length;
  const reporting = visibleApms.filter((entity) => entity.reporting !== false).length;
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const priorityApms = [...visibleApms].sort((a, b) => severityRank(a.alert_severity) - severityRank(b.alert_severity)).slice(0, 6);

  if (accountsQuery.isLoading || apmQuery.isLoading) return <LoadingSkeleton lines={8} />;
  if (accountsQuery.error) return <ErrorState body={(accountsQuery.error as Error).message} onRetry={() => accountsQuery.refetch()} />;
  if (apmQuery.error) return <ErrorState body={(apmQuery.error as Error).message} onRetry={() => apmQuery.refetch()} />;
  if (!apms.length) return <EmptyState title="No encontré APMs accesibles" body="La conexión está activa, pero New Relic no devolvió aplicaciones APM para tus cuentas. Revisa que tu clave tenga acceso, que la región sea correcta y que las aplicaciones estén enviando datos." action={<Link href="/settings"><Button>Revisar sesión</Button></Link>} />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Resumen operativo</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{selectedAccount?.name || 'Panel New Relic'}</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Vista consolidada de las APMs accesibles con la sesión actual. La cuenta activa se selecciona automáticamente por mayor cobertura APM y puedes cambiarla desde la barra superior.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/app/apms"><Button><Activity className="h-4 w-4" /> Ver APMs</Button></Link>
          <Link href="/app/chat"><Button variant="primary"><Bot className="h-4 w-4" /> Preguntar al copiloto</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cuentas accesibles" value={accounts.length} hint="Detectadas con tu conexión actual" />
        <MetricCard label="APMs visibles" value={visibleApms.length} hint={accountId ? `Filtradas por ID de cuenta ${accountId}` : 'Todas las cuentas disponibles'} />
        <MetricCard label="APMs críticas" value={critical} hint="Según alertSeverity de New Relic" />
        <MetricCard label="Reportando" value={reporting} hint={`${warning} con warning en la cuenta activa`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">APMs que conviene revisar primero</h2>
              <p className="mt-2 text-sm text-slate-400">Ordenadas por severidad para que entres rápido a la entidad con mayor señal operativa.</p>
            </div>
            <Gauge className="h-5 w-5 text-emerald-200" />
          </div>
          <div className="mt-5 space-y-3">
            {priorityApms.map((entity) => (
              <Link key={entity.guid} href={`/app/apms/${encodeURIComponent(entity.guid)}`} className="focus-ring flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 transition hover:border-emerald-300/30 hover:bg-white/[.06]">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{entity.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{entity.language || 'lenguaje no detectado'} · ID de cuenta {entity.account_id}</p>
                </div>
                <div className="flex items-center gap-3"><HealthBadge severity={entity.alert_severity} /><ArrowRight className="h-4 w-4 text-slate-500" /></div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><RadioTower className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold text-white">Base temporal</h2>
              <p className="mt-1 text-sm text-slate-400">Consultas en horario UTC</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-400">Los rangos rápidos usan el tiempo relativo de New Relic. Los rangos personalizados usan UTC para que la gráfica coincida con el periodo seleccionado.</p>
          <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.06] p-4 text-sm text-emerald-100">Ajusta el rango desde la barra superior y vuelve a abrir cualquier APM para refrescar sus métricas con la misma ventana temporal.</div>
        </Card>
      </div>
    </div>
  );
}
