import { AppShell } from '@/components/app-shell';
import { SessionSettings } from '@/components/session-settings';

export default function ConfiguracionPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Sesión</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Conexión y seguridad</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Administra la sesión activa, revisa las cuentas disponibles y cierra sesión cuando quieras desconectar New Relic de este espacio local.</p>
        </div>
        <SessionSettings />
      </div>
    </AppShell>
  );
}
