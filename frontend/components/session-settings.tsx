'use client';

import { useQuery } from '@tanstack/react-query';
import { Bot, Database, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { apiGet, getStoredSession } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { LogoutButton } from '@/components/logout-button';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { ErrorState } from '@/components/error-state';
import type { AccountSummary, CredentialSession } from '@/types';

type CurrentCredentialResponse = { ok: boolean; profile: CredentialSession };
type AccountsResponse = { ok: boolean; accounts: AccountSummary[] };
type HealthResponse = { ok: boolean; llm_provider?: string; has_gemini_key?: boolean; has_openai_key?: boolean };

export function SessionSettings() {
  const stored = getStoredSession();
  const profileQuery = useQuery({ queryKey: ['credential-current'], queryFn: () => apiGet<CurrentCredentialResponse>('/api/credentials/current'), retry: 1 });
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => apiGet<AccountsResponse>('/api/accounts'), retry: 1 });
  const healthQuery = useQuery({ queryKey: ['health'], queryFn: () => apiGet<HealthResponse>('/api/health'), retry: 1 });
  const profile = profileQuery.data?.profile ?? stored;

  if (profileQuery.isLoading && !profile) return <LoadingSkeleton lines={6} />;
  if (profileQuery.error && !profile) return <ErrorState body={(profileQuery.error as Error).message} onRetry={() => profileQuery.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><ShieldCheck className="h-5 w-5" /></div>
          <p className="mt-4 text-sm text-slate-400">Espacio de trabajo</p>
          <p className="mt-2 text-lg font-semibold text-white">{profile?.label || 'Sesión activa'}</p>
        </Card>
        <Card className="p-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-300/10 text-lime-200"><Server className="h-5 w-5" /></div>
          <p className="mt-4 text-sm text-slate-400">Región New Relic</p>
          <p className="mt-2 text-lg font-semibold text-white">{profile?.region || 'US'}</p>
        </Card>
        <Card className="p-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Database className="h-5 w-5" /></div>
          <p className="mt-4 text-sm text-slate-400">Cuentas accesibles</p>
          <p className="mt-2 text-lg font-semibold text-white">{accountsQuery.data?.accounts.length ?? profile?.account_ids?.length ?? '—'}</p>
        </Card>
        <Card className="p-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300/10 text-amber-200"><KeyRound className="h-5 w-5" /></div>
          <p className="mt-4 text-sm text-slate-400">API Key</p>
          <p className="mt-2 text-lg font-semibold text-white">{profile?.masked_api_key || 'Protegida'}</p>
        </Card>
        <Card className="p-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Bot className="h-5 w-5" /></div>
          <p className="mt-4 text-sm text-slate-400">Proveedor IA</p>
          <p className="mt-2 text-lg font-semibold text-white">{healthQuery.data?.llm_provider === 'gemini' ? 'Gemini' : healthQuery.data?.llm_provider === 'openai' ? 'OpenAI' : 'Desactivado'}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white">Cuentas disponibles</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">OpsPilot selecciona automáticamente la cuenta con más APMs visibles. Puedes cambiarla desde el selector superior cuando necesites investigar otra cuenta.</p>
          <div className="mt-5 space-y-3">
            {accountsQuery.isLoading && <LoadingSkeleton lines={3} />}
            {accountsQuery.error && <ErrorState body={(accountsQuery.error as Error).message} onRetry={() => accountsQuery.refetch()} />}
            {accountsQuery.data?.accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3">
                <div>
                  <p className="font-medium text-white">{account.name || `Cuenta ${account.id}`}</p>
                  <p className="text-xs text-slate-500">ID de cuenta {account.id}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white">Cerrar sesión</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Al cerrar sesión, OpsPilot deja de usar esta conexión. Para volver a entrar tendrás que conectar New Relic de nuevo.</p>
          <div className="mt-6"><LogoutButton /></div>
        </Card>
      </div>
    </div>
  );
}
