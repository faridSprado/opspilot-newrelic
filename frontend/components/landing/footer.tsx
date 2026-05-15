import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-white/[.08] bg-[#03050a] px-6 py-10 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 text-sm text-slate-500 sm:flex-row">
        <p>OpsPilot for New Relic · Analítica segura para APM</p>
        <div className="flex gap-5">
          <Link href="/connect" className="hover:text-slate-200">Ingresar</Link>
        </div>
      </div>
    </footer>
  );
}
