import { APMList } from '@/components/apm-list';

export default function APMsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Descubrimiento APM</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">APMs</h1>
        <p className="mt-3 text-slate-400">Busca, filtra y selecciona entidades APM accesibles con tus credenciales.</p>
      </div>
      <APMList />
    </div>
  );
}
