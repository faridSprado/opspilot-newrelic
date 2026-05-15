'use client';

import { Search } from 'lucide-react';
import { AccountSelector } from '@/components/account-selector';
import { LogoutButton } from '@/components/logout-button';
import { TimeRangePicker } from '@/components/time-range-picker';

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('open-command-palette'));
}

export function Topbar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-20 border-b border-white/10 bg-slate-950/65 backdrop-blur-xl lg:left-auto">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button
          className="focus-ring hidden min-w-80 items-center justify-between rounded-2xl border border-white/10 bg-white/[.04] px-4 py-2 text-sm text-slate-400 transition hover:border-emerald-300/30 hover:bg-white/[.06] hover:text-slate-200 md:flex"
          onClick={openCommandPalette}
          aria-label="Abrir buscador global con Ctrl o Command K"
        >
          <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Buscar APMs, comandos o consultas</span>
          <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-300">
            Ctrl / ⌘ K
          </span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <AccountSelector />
          <TimeRangePicker />
          <LogoutButton compact />
        </div>
      </div>
    </header>
  );
}
