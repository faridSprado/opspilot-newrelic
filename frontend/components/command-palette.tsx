'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Gauge, Search, Settings, TerminalSquare, Zap } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { severityLabel } from '@/components/health-badge';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { EntitySummary } from '@/types';

type EntityListResponse = { ok: boolean; entities: EntitySummary[] };

type CommandItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof Gauge;
  keywords: string;
};

const commands: CommandItem[] = [
  { href: '/app', label: 'Abrir resumen', description: 'Estado general, cuentas y APMs prioritarias.', icon: Gauge, keywords: 'dashboard resumen overview estado cuenta' },
  { href: '/app/chat', label: 'Preguntar al copiloto', description: 'Consulta New Relic en lenguaje natural.', icon: Bot, keywords: 'chat copiloto pregunta ia new relic' },
  { href: '/app/apms', label: 'Explorar APMs', description: 'Busca servicios, filtra por estado y abre detalles.', icon: Activity, keywords: 'apm servicios entidades aplicaciones' },
  { href: '/settings', label: 'Gestionar sesión', description: 'Credenciales, región, proveedor IA y cierre de sesión.', icon: Settings, keywords: 'sesion settings configuracion credenciales region gemini openai' }
];

const promptTemplates = [
  {
    label: 'Throughput y tiempo de respuesta',
    prompt: 'Grafica throughput y response time minuto a minuto de las últimas 3 horas',
    description: 'Genera una consulta segura por minuto.'
  },
  {
    label: 'Errores recientes',
    prompt: 'Busca errores recientes por clase y mensaje',
    description: 'Agrupa TransactionError para priorizar fallos.'
  },
  {
    label: 'Endpoints más lentos',
    prompt: 'Dame los endpoints más lentos con p95 y p99',
    description: 'Identifica transacciones con mayor latencia.'
  },
  {
    label: 'Impacto del último despliegue',
    prompt: 'Analiza el impacto del último deploy en latencia y errores',
    description: 'Correlaciona despliegues con señales APM.'
  },
  {
    label: 'Inventario de datos',
    prompt: 'Detecta qué fuentes de datos tiene esta APM y qué atributos puedo consultar',
    description: 'Revisa Transaction, Span, Metric, Log y TransactionError.'
  }
];

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matches(text: string, query: string) {
  const q = normalize(query.trim());
  if (!q) return true;
  return normalize(text).includes(q);
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const setSelectedEntity = useWorkspaceStore((state) => state.setSelectedEntity);
  const setAccountId = useWorkspaceStore((state) => state.setAccountId);

  const { data, isFetching } = useQuery({
    queryKey: ['command-palette-apms'],
    queryFn: () => apiGet<EntityListResponse>('/api/entities/apm'),
    enabled: open,
    staleTime: 60_000
  });

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
      if (open && event.key === 'Enter' && query.trim()) {
        event.preventDefault();
        setOpen(false);
        router.push(`/app/chat?prompt=${encodeURIComponent(query.trim())}`);
      }
    };
    const openCommand = () => setOpen(true);
    window.addEventListener('keydown', keydown);
    window.addEventListener('open-command-palette', openCommand);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('open-command-palette', openCommand);
    };
  }, [open, query, router]);

  const filteredCommands = useMemo(
    () => commands.filter(command => matches(`${command.label} ${command.description} ${command.keywords}`, query)),
    [query]
  );
  const filteredPrompts = useMemo(
    () => promptTemplates.filter(template => matches(`${template.label} ${template.prompt} ${template.description}`, query)),
    [query]
  );
  const filteredEntities = useMemo(() => {
    const q = query.trim();
    const entities = data?.entities ?? [];
    return entities
      .filter(entity => matches(`${entity.name} ${entity.language ?? ''} ${entity.type ?? ''} ${entity.domain ?? ''} ${entity.alert_severity ?? ''}`, q))
      .slice(0, q ? 8 : 5);
  }, [data?.entities, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 p-4 backdrop-blur-md" onClick={() => setOpen(false)}>
      <div className="mx-auto mt-20 max-w-3xl overflow-hidden rounded-[2rem] border border-white/[.12] bg-slate-950 shadow-premium" onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Search className="h-4 w-4 text-emerald-300" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar APMs, comandos o escribir una pregunta para el copiloto…"
            className="h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
          />
          <span className="rounded-lg border border-white/10 bg-white/[.04] px-2 py-1 text-[11px] text-slate-400">Enter pregunta</span>
          <span className="rounded-lg border border-white/10 bg-white/[.04] px-2 py-1 text-[11px] text-slate-400">Esc cerrar</span>
        </div>
        <div className="max-h-[70vh] overflow-auto p-3">
          <section className="p-2">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">APMs</p>
            {isFetching && <p className="px-2 py-3 text-sm text-slate-500">Buscando entidades en New Relic…</p>}
            {!isFetching && filteredEntities.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">No encontré APMs con ese texto.</p>}
            <div className="space-y-1">
              {filteredEntities.map(entity => (
                <Link
                  key={entity.guid}
                  href={`/app/apms/${encodeURIComponent(entity.guid)}`}
                  onClick={() => {
                    setSelectedEntity(entity);
                    if (entity.account_id) setAccountId(entity.account_id);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-slate-300 hover:bg-white/[.06] hover:text-white"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Activity className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{entity.name}</span>
                      <span className="block truncate text-xs text-slate-500">{entity.language ?? 'lenguaje no detectado'} · {entity.reporting ? 'activa' : 'sin reporte'} · {severityLabel(entity.alert_severity ?? entity.health_status)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-600">Abrir</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="p-2">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Comandos</p>
            <div className="space-y-1">
              {filteredCommands.map(({ href, label, description, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-300 hover:bg-white/[.06] hover:text-white">
                  <Icon className="h-4 w-4 text-emerald-300" />
                  <span><span className="block font-medium">{label}</span><span className="block text-xs text-slate-500">{description}</span></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="p-2">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Consultas rápidas</p>
            <div className="space-y-1">
              {filteredPrompts.map((template) => (
                <Link key={template.prompt} href={`/app/chat?prompt=${encodeURIComponent(template.prompt)}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-300 hover:bg-white/[.06] hover:text-white">
                  <Zap className="h-4 w-4 text-lime-300" />
                  <span><span className="block font-medium">{template.label}</span><span className="block text-xs text-slate-500">{template.description}</span></span>
                </Link>
              ))}
              {query.trim() ? (
                <button
                  onClick={() => { setOpen(false); router.push(`/app/chat?prompt=${encodeURIComponent(query.trim())}`); }}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/[.06] hover:text-white"
                >
                  <TerminalSquare className="h-4 w-4 text-emerald-300" />
                  <span><span className="block font-medium">Preguntar al copiloto</span><span className="block text-xs text-slate-500">“{query.trim()}”</span></span>
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
