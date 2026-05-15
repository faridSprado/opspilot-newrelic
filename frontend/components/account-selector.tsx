'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { apiGet } from '@/lib/api';
import type { AccountSummary, EntitySummary } from '@/types';
import { useWorkspaceStore } from '@/stores/workspace-store';

type AccountsResponse = { ok: boolean; accounts: AccountSummary[] };
type EntityListResponse = { ok: boolean; entities: EntitySummary[] };

export function AccountSelector() {
  const accountId = useWorkspaceStore((state) => state.accountId);
  const setAccountId = useWorkspaceStore((state) => state.setAccountId);
  const { data: accountData } = useQuery({ queryKey: ['accounts'], queryFn: () => apiGet<AccountsResponse>('/api/accounts') });
  const { data: apmData } = useQuery({ queryKey: ['apms'], queryFn: () => apiGet<EntityListResponse>('/api/entities/apm') });
  const accounts = accountData?.accounts ?? [];
  const entities = apmData?.entities ?? [];

  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const entity of entities) {
      if (entity.account_id) map.set(entity.account_id, (map.get(entity.account_id) ?? 0) + 1);
    }
    return map;
  }, [entities]);

  useEffect(() => {
    if (accountId || !accounts.length) return;
    const best = [...accounts].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0];
    if (best) setAccountId(best.id);
  }, [accountId, accounts, counts, setAccountId]);

  return (
    <select value={accountId ?? ''} onChange={(event) => setAccountId(event.target.value ? Number(event.target.value) : undefined)} className="focus-ring h-9 max-w-56 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-slate-200" aria-label="Cuenta New Relic activa">
      <option value="">Cuenta</option>
      {accounts.map(account => {
        const count = counts.get(account.id) ?? 0;
        return <option key={account.id} value={account.id}>{account.name ?? account.id}{count ? ` · ${count} APMs` : ''}</option>;
      })}
    </select>
  );
}
