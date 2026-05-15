import { APMDetail } from '@/components/apm-detail';

export default function APMDetailPage({ params }: { params: { entityGuid: string } }) {
  return <APMDetail guid={decodeURIComponent(params.entityGuid)} />;
}
