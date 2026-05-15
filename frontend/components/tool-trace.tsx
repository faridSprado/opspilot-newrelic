import { CheckCircle2, XCircle } from 'lucide-react';
import type { ToolTraceItem } from '@/types';

export function ToolTrace({ traces }: { traces: ToolTraceItem[] }) {
  if (!traces.length) return null;
  return (
    <div className="space-y-2">
      {traces.map((trace, idx) => (
        <details key={`${trace.tool}-${idx}`} className="rounded-2xl border border-white/10 bg-white/[.03] p-3 text-xs text-slate-400">
          <summary className="flex cursor-pointer items-center gap-2 text-slate-300">
            {trace.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <XCircle className="h-4 w-4 text-red-300" />} {trace.tool} {trace.duration_ms ? `· ${trace.duration_ms.toFixed(0)} ms` : ''}
          </summary>
          <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-400">{JSON.stringify({ input: trace.input, output: trace.safe_output_preview }, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}
