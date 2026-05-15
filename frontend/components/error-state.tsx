import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function ErrorState({ title = 'No pude completar la acción', body, onRetry }: { title?: string; body: string; onRetry?: () => void }) {
  return (
    <Card className="border-red-400/20 bg-red-950/20 p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-400/10 text-red-200"><AlertTriangle className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold text-red-100">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-red-100/70">{body}</p>
          {onRetry && <Button className="mt-4" size="sm" variant="danger" onClick={onRetry}>Reintentar</Button>}
        </div>
      </div>
    </Card>
  );
}
