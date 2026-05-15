'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredProfileId } from '@/lib/api';
import { LoadingSkeleton } from '@/components/loading-skeleton';

export function ConnectGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const profileId = getStoredProfileId();
    if (profileId) {
      router.replace(searchParams.get('next') || '/app');
      return;
    }
    setReady(true);
  }, [router, searchParams]);

  if (!ready) {
    return (
      <main className="min-h-screen bg-ink bg-radial-emerald px-6 py-12 lg:px-8">
        <div className="mx-auto max-w-2xl"><LoadingSkeleton lines={4} /></div>
      </main>
    );
  }

  return children;
}
