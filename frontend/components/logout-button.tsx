'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiDelete, clearProfileId, getStoredProfileId } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function logout() {
    const profileId = getStoredProfileId();
    try {
      if (profileId && profileId !== 'env') await apiDelete<{ ok: boolean }>('/api/credentials');
    } catch {
      // La sesión local debe cerrarse aunque el perfil ya no exista en backend.
    } finally {
      clearProfileId();
      toast.success('Sesión cerrada');
      router.replace('/');
    }
  }

  return (
    <Button type="button" variant="ghost" size={compact ? 'sm' : 'md'} onClick={logout} className="border border-white/10 bg-white/[.03]">
      <LogOut className="h-4 w-4" /> {compact ? 'Salir' : 'Cerrar sesión'}
    </Button>
  );
}
