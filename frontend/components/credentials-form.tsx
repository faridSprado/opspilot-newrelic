'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { apiPost, storeProfileId } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { AccountSummary, CredentialSession } from '@/types';

const schema = z.object({
  label: z.string().min(1).max(80),
  api_key: z.string().min(8, 'Ingresa una clave válida'),
  region: z.enum(['US', 'EU']),
  persist: z.boolean()
});

type FormValues = z.infer<typeof schema>;

type CredentialResponse = CredentialSession & {
  ok: boolean;
  profile_id: string;
  account_ids: number[];
  accounts: AccountSummary[];
  masked_api_key: string;
  persisted: boolean;
  message: string;
};

export function CredentialsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showSecret, setShowSecret] = useState(false);
  const [validated, setValidated] = useState<CredentialResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: 'Espacio principal', region: 'US', persist: true }
  });
  const persist = watch('persist');

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      const endpoint = values.persist ? '/api/credentials/save' : '/api/credentials/validate';
      const result = await apiPost<CredentialResponse>(endpoint, values);
      const session: CredentialSession = {
        profile_id: result.profile_id,
        label: result.label,
        region: result.region,
        account_ids: result.account_ids,
        accounts: result.accounts,
        persisted: result.persisted,
        masked_api_key: result.masked_api_key
      };
      storeProfileId(result.profile_id, values.persist, session);
      setValidated(result);
      toast.success('Conexión validada con New Relic');
      router.replace(searchParams.get('next') || '/app');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pude validar las credenciales.';
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Acceso seguro</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Conecta tu cuenta New Relic</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Usaremos tu clave solo para conectar con New Relic y mostrarte la información de tus aplicaciones. No se guarda en el navegador.</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Nombre del espacio de trabajo</span>
            <input className="focus-ring h-11 w-full rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm text-white placeholder:text-slate-500" {...register('label')} />
            {errors.label && <span className="text-xs text-red-300">{errors.label.message}</span>}
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Clave de acceso de New Relic</span>
              <div className="relative">
                <input type={showSecret ? 'text' : 'password'} className="focus-ring h-11 w-full rounded-xl border border-white/10 bg-white/[.04] px-4 pr-11 text-sm text-white placeholder:text-slate-500" autoComplete="off" {...register('api_key')} />
                <button type="button" className="absolute right-3 top-3 text-slate-400 hover:text-white" onClick={() => setShowSecret(!showSecret)} aria-label="Mostrar u ocultar API key">{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
              {errors.api_key && <span className="text-xs text-red-300">{errors.api_key.message}</span>}
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Región</span>
              <select className="focus-ring h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-white" {...register('region')}>
                <option value="US">US</option>
                <option value="EU">EU</option>
              </select>
            </label>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-slate-300">
            <input type="checkbox" className="mt-1" {...register('persist')} />
            <span><strong className="text-white">Recordar esta conexión.</strong> Si lo desactivas, tendrás que conectar New Relic de nuevo cuando cierres la app.</span>
          </label>
          {submitError && <div className="rounded-2xl border border-red-400/25 bg-red-500/[.08] p-4 text-sm text-red-100">{submitError}</div>}
          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Validando acceso…' : persist ? 'Validar e ingresar' : 'Validar para esta sesión'} <ArrowRight className="h-4 w-4" /></Button>
        </form>
        {validated && (
          <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
            <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> {validated.message}</div>
            <p className="mt-2 text-emerald-100/80">Key: {validated.masked_api_key} · Cuentas: {validated.account_ids.join(', ')}</p>
          </div>
        )}
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[.08] p-4 text-sm text-amber-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Usa una clave de acceso de New Relic. OpsPilot detectará tus cuentas disponibles automáticamente.</p>
        </div>
      </CardContent>
    </Card>
  );
}
