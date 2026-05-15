import { Bot, ChartNoAxesCombined, KeyRound, Layers3, Radar, Workflow } from 'lucide-react';

const features = [
  { icon: Bot, title: 'Análisis conversacional de APM', body: 'Haz preguntas simples; OpsPilot elige cómo consultar New Relic y explica hallazgos accionables.' },
  { icon: ChartNoAxesCombined, title: 'Motor de gráficas seguro', body: 'OpsPilot convierte datos reales en gráficas claras y evita visualizaciones engañosas.' },
  { icon: KeyRound, title: 'Seguridad desde el diseño', body: 'Tu clave se protege en la app y no se comparte con el modelo de IA.' },
  { icon: Layers3, title: 'Espacios de trabajo multi-cuenta', body: 'Soporta región US/EU, múltiples cuentas detectadas automáticamente y espacios de trabajo guardados.' },
  { icon: Radar, title: 'Investigaciones', body: 'Correlaciona deploys, errores, latencia, throughput, logs y trazas cuando están disponibles.' },
  { icon: Workflow, title: 'Trazabilidad de herramientas', body: 'Cada respuesta puede mostrar qué se consultó, los datos usados, las gráficas y las exportaciones disponibles.' }
];

export function FeatureGrid() {
  return (
    <section className="bg-ink px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Diseñado para equipos de observabilidad</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Una experiencia premium sobre datos reales de New Relic.</h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <article key={title} className="premium-border group rounded-3xl p-6 transition hover:-translate-y-1 hover:border-emerald-300/[.35]">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/[.06] text-emerald-200 group-hover:bg-emerald-300/[.15]"><Icon className="h-5 w-5" /></div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
