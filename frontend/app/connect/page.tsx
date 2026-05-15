import Link from 'next/link';
import { Suspense } from 'react';
import { ConnectGate } from '@/components/connect-gate';
import { CredentialsForm } from '@/components/credentials-form';

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectGate>
        <main className="min-h-screen bg-ink bg-radial-emerald px-6 py-10 lg:px-8">
          <div className="mx-auto mb-10 flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">← Inicio</Link>
          </div>
          <CredentialsForm />
        </main>
      </ConnectGate>
    </Suspense>
  );
}
