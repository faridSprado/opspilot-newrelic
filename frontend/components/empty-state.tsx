import { Inbox } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card className="grid min-h-64 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/[.06] text-slate-300"><Inbox className="h-6 w-6" /></div>
        <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </Card>
  );
}
