'use client';

import { Activity, Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HealthBadge } from '@/components/health-badge';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { EntitySummary } from '@/types';

export function ChatApmSelector({ entities, onSelect }: { entities: EntitySummary[]; onSelect?: (entity: EntitySummary) => void }) {
  const [query, setQuery] = useState('');
  const selectedEntity = useWorkspaceStore((state) => state.selectedEntity);
  const setSelectedEntity = useWorkspaceStore((state) => state.setSelectedEntity);
  const setAccountId = useWorkspaceStore((state) => state.setAccountId);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return entities;
    return entities.filter((entity) => [entity.name, entity.language, entity.domain, entity.type, entity.account_id?.toString()]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(text));
  }, [entities, query]);

  function choose(entity: EntitySummary) {
    setSelectedEntity(entity);
    if (entity.account_id) setAccountId(entity.account_id);
    onSelect?.(entity);
  }

  return (
    <section className="rounded-3xl border border-emerald-300/15 bg-slate-950/70 p-4 shadow-2xl shadow-emerald-950/20">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Selecciona una APM para continuar</p>
          <p className="mt-1 text-xs text-slate-400">Lista completa devuelta por New Relic. Al seleccionar una, el copiloto usará esa entidad como contexto en las siguientes preguntas.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-xs text-slate-300">{filtered.length} de {entities.length} APMs</span>
      </div>

      <label className="mt-4 flex h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] px-3 text-sm text-slate-300">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar por nombre, cuenta, lenguaje o tipo…"
          className="h-full flex-1 bg-transparent text-white outline-none placeholder:text-slate-500"
        />
      </label>

      <div className="mt-4 max-h-[34rem] space-y-2 overflow-auto pr-1">
        {filtered.map((entity) => {
          const selected = selectedEntity?.guid === entity.guid;
          return (
            <button
              key={entity.guid}
              type="button"
              onClick={() => choose(entity)}
              className={cn(
                'group flex w-full items-center justify-between gap-4 rounded-2xl border p-3 text-left transition',
                selected
                  ? 'border-emerald-300/40 bg-emerald-300/10 shadow-lg shadow-emerald-950/20'
                  : 'border-white/10 bg-white/[.03] hover:border-emerald-300/30 hover:bg-white/[.06]'
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-white">{entity.name}</p>
                    <HealthBadge severity={entity.alert_severity ?? entity.health_status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    Cuenta {entity.account_id ?? 'sin cuenta'} · {entity.domain ?? 'APM'} · {entity.type ?? 'APPLICATION'} · {entity.language ?? 'lenguaje no detectado'} · {entity.reporting ? 'Reportando' : 'Sin reporting confirmado'}
                  </p>
                </div>
              </div>
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-2xl border text-xs font-semibold', selected ? 'border-emerald-300/40 bg-emerald-300 text-slate-950' : 'border-white/10 text-slate-400 group-hover:text-emerald-200')}>
                {selected ? <Check className="h-4 w-4" /> : 'Elegir'}
              </div>
            </button>
          );
        })}
      </div>

      {!filtered.length ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No hay APMs que coincidan con ese filtro.</p> : null}
    </section>
  );
}
