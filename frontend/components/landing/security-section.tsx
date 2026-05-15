import { ShieldCheck } from 'lucide-react';

const rules = ['Tu clave no se muestra ni se guarda en el navegador', 'La IA recibe solo la información necesaria para responder', 'Las consultas son de solo lectura', 'Los datos sensibles se ocultan en mensajes y errores', 'La conexión está protegida por la app', 'No se inventan datos cuando New Relic no responde'];

export function SecuritySection() {
  return (
    <section className="bg-[#070a12] px-6 py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-sm text-emerald-200"><ShieldCheck className="h-4 w-4" /> Seguridad primero</div>
          <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Diseñado para cuidar tu acceso a New Relic.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">Tu clave se usa únicamente para consultar New Relic desde la app. OpsPilot evita mostrar secretos y te avisa con claridad si algo no se puede consultar.</p>
        </div>
        <div className="premium-border rounded-3xl p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {rules.map(rule => <div key={rule} className="rounded-2xl border border-white/[.08] bg-white/[.03] p-4 text-sm text-slate-300">{rule}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
