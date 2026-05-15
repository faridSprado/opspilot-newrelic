const steps = [
  ['01', 'Conectar', 'Ingresa tu clave de acceso y región. OpsPilot detecta tus cuentas automáticamente.'],
  ['02', 'Descubrir', 'OpsPilot encuentra tus aplicaciones, alertas y datos disponibles en New Relic.'],
  ['03', 'Preguntar', 'Haz preguntas sobre rendimiento, errores, despliegues, logs o comportamiento general.'],
  ['04', 'Entender + compartir', 'Recibes una explicación clara, gráficas, tablas y opciones para exportar resultados.']
];

export function HowItWorks() {
  return (
    <section className="bg-ink px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Cómo funciona</h2>
        <div className="mt-12 grid gap-4 lg:grid-cols-4">
          {steps.map(([num, title, body]) => (
            <div key={title} className="premium-border rounded-3xl p-6">
              <div className="text-sm text-emerald-300">{num}</div>
              <h3 className="mt-6 text-xl font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
