'use client';

import { AuthGate } from '@/components/auth-gate';
import { CommandPalette } from '@/components/command-palette';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useWorkspaceStore((state) => state.sidebarCollapsed);
  return (
    <AuthGate>
      <div className="min-h-screen bg-ink text-slate-100">
        <div className="fixed inset-0 bg-radial-emerald bg-radial-lime opacity-80" />
        <div className="fixed inset-0 bg-grid opacity-35" />
        <Sidebar />
        <div className={cn('relative transition-all duration-300', collapsed ? 'lg:pl-20' : 'lg:pl-72')}>
          <Topbar />
          <main className="mx-auto max-w-[1600px] px-4 pb-10 pt-24 sm:px-6 lg:px-8">{children}</main>
        </div>
        <CommandPalette />
      </div>
    </AuthGate>
  );
}
