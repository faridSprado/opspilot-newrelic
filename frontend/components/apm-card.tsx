'use client';

import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { HealthBadge } from '@/components/health-badge';
import type { EntitySummary } from '@/types';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function APMCard({ entity }: { entity: EntitySummary }) {
  const setSelectedEntity = useWorkspaceStore((state) => state.setSelectedEntity);
  const setAccountId = useWorkspaceStore((state) => state.setAccountId);
  return (
    <Link href={`/app/apms/${encodeURIComponent(entity.guid)}`} onClick={() => { setSelectedEntity(entity); if (entity.account_id) setAccountId(entity.account_id); }}>
      <Card className="group p-5 transition hover:-translate-y-1 hover:border-emerald-300/[.35]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Activity className="h-5 w-5" /></div>
            <div>
              <h3 className="font-semibold text-white">{entity.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{entity.domain ?? 'APM'} · {entity.type ?? 'APPLICATION'} · {entity.language ?? 'lenguaje no detectado'}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-emerald-200" />
        </div>
        <div className="mt-5 flex items-center justify-between">
          <HealthBadge severity={entity.alert_severity ?? entity.health_status} />
          {entity.reporting !== null && entity.reporting !== undefined && <span className="text-xs text-slate-500">{entity.reporting ? 'Reportando' : 'No reporta'}</span>}
        </div>
      </Card>
    </Link>
  );
}
