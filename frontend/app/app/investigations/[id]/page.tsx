import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

export default function InvestigationPage({ params }: { params: { id: string } }) {
  return <EmptyState title={`Investigación ${params.id}`} body="Abre una investigación desde una respuesta del copiloto o una gráfica para ver resumen ejecutivo, hallazgos y evidencias." action={<a href="/app/chat"><Button variant="primary">Preguntar al copiloto</Button></a>} />;
}
