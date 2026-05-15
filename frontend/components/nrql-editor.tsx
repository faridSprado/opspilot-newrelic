'use client';

import dynamic from 'next/dynamic';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false, loading: () => <pre className="rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">Cargando editor…</pre> });

export function NRQLEditor({ value, compact = false }: { value?: string | null; compact?: boolean }) {
  if (!value) return null;
  return (
    <div className={compact ? 'overflow-hidden rounded-xl border border-white/10 bg-slate-950' : 'overflow-hidden rounded-2xl border border-white/10 bg-slate-950'}>
      {!compact ? (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-medium text-white">NRQL</p>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(value); toast.success('NRQL copiado'); }}><Copy className="h-4 w-4" /> Copiar</Button>
        </div>
      ) : (
        <div className="flex justify-end border-b border-white/10 px-3 py-2">
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(value); toast.success('NRQL copiado'); }}><Copy className="h-4 w-4" /> Copiar</Button>
        </div>
      )}
      <CodeMirror value={value} editable={false} basicSetup={{ lineNumbers: false, foldGutter: false }} theme="dark" />
    </div>
  );
}
