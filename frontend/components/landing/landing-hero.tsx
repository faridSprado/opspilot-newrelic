import { Activity, LockKeyhole, Search } from 'lucide-react';
import { AuthAwareLandingActions } from '@/components/auth-aware-actions';

export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink bg-radial-emerald bg-radial-lime">
      <div className="absolute inset-0 bg-grid opacity-60" />
      <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col items-center px-6 py-24 text-center lg:px-8">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[.08] px-4 py-2 text-sm text-emerald-100 shadow-glow">
          <Search className="h-4 w-4" /> Analítica operativa sobre datos reales de New Relic
        </div>
        <h1 className="max-w-5xl text-balance bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-5xl font-semibold tracking-[-0.04em] text-transparent sm:text-7xl lg:text-8xl">
          Investiga APMs, métricas y alertas con preguntas simples.
        </h1>
        <p className="mt-7 max-w-3xl text-balance text-lg leading-8 text-slate-300 sm:text-xl">
          OpsPilot conecta con New Relic, encuentra tus aplicaciones APM y convierte preguntas operativas en gráficas claras, tablas exportables y explicaciones accionables.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <AuthAwareLandingActions />
        </div>

        <div className="relative mt-16 w-full max-w-6xl animate-float rounded-[2rem] border border-white/[.12] bg-slate-950/70 p-2 shadow-premium backdrop-blur-xl">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#070b16] p-5 text-left">
            <div className="mb-5 flex items-center justify-between border-b border-white/[.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-300/[.15] text-emerald-200"><Activity className="h-5 w-5" /></div>
                <div><p className="font-medium text-white">Investigación APM</p><p className="text-xs text-slate-400">Datos consultados desde New Relic</p></div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200"><LockKeyhole className="h-3 w-3" /> Tu clave no se comparte con el navegador ni con la IA</div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[.9fr_1.4fr]">
              <div className="space-y-3">
                {['Descubrimiento de cuentas y APMs', 'Métricas clave por rango UTC', 'Consultas revisables', 'Datos crudos exportables'].map(item => <div key={item} className="rounded-2xl border border-white/[.08] bg-white/[.03] p-4 text-sm text-slate-300">{item}</div>)}
              </div>
              <div className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-slate-900 to-slate-950 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="h-4 w-52 rounded-full bg-slate-700/80" />
                  <span className="rounded-full border border-emerald-300/20 px-3 py-1 text-xs text-emerald-100">UTC</span>
                </div>
                <div className="flex h-64 items-end gap-2 border-b border-l border-slate-700/60 p-4">
                  {Array.from({ length: 34 }).map((_, i) => <div key={i} className="w-full rounded-t-md bg-gradient-to-t from-emerald-400/35 to-lime-300/60" style={{ height: `${26 + ((i * 17) % 72)}%` }} />)}
                </div>
                <p className="mt-3 text-xs text-slate-500">Las gráficas se muestran solo cuando New Relic devuelve datos suficientes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
