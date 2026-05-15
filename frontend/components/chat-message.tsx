import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ChatMessage({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const assistant = role === 'assistant';
  return (
    <div className={cn('flex gap-3', assistant ? 'justify-start' : 'justify-end')}>
      {assistant && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Bot className="h-4 w-4" /></div>}
      <div className={cn('max-w-[82%] rounded-3xl px-5 py-4 text-sm leading-6', assistant ? 'border border-white/10 bg-white/[.04] text-slate-200' : 'bg-emerald-300 text-slate-950')}>
        {content}
      </div>
      {!assistant && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/[.08] text-slate-200"><User className="h-4 w-4" /></div>}
    </div>
  );
}
