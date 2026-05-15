'use client';

import Link from 'next/link';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStoredProfileId } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function AuthAwareLandingActions() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const refresh = () => setConnected(Boolean(getStoredProfileId()));
    refresh();
    window.addEventListener('opspilot-session-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('opspilot-session-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (connected) {
    return (
      <Link href="/app">
        <Button variant="primary" size="lg">Abrir panel operativo <LayoutDashboard className="h-4 w-4" /></Button>
      </Link>
    );
  }

  return (
    <Link href="/connect">
      <Button variant="primary" size="lg">Conectar New Relic <ArrowRight className="h-4 w-4" /></Button>
    </Link>
  );
}
