'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredProfileId } from '@/lib/api';
import { LoadingSkeleton } from '@/components/loading-skeleton';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const profileId = getStoredProfileId();
    if (!profileId) {
      router.replace(`/connect?next=${encodeURIComponent(pathname || '/app')}`);
      return;
    }
    setAllowed(true);
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-ink px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Validando sesión</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Preparando tu espacio operativo</h1>
          <div className="mt-8"><LoadingSkeleton lines={5} /></div>
        </div>
      </div>
    );
  }

  return children;
}
