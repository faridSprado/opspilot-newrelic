'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Cloud, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { API_BASE, type BackendWakeupEventDetail, shouldWarmBackend, warmBackend } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type VisibleStatus = BackendWakeupEventDetail['status'] | 'idle';

export function BackendWakeup() {
  const [status, setStatus] = useState<VisibleStatus>('idle');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState<number | undefined>();
  const [maxAttempts, setMaxAttempts] = useState<number | undefined>();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const lastVisibleStatusRef = useRef<VisibleStatus>('idle');
  const canWarm = useMemo(() => shouldWarmBackend(), []);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    lastVisibleStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!canWarm) return;

    let readyTimer: number | undefined;
    let hideTimer: number | undefined;

    const hideBanner = () => {
      setVisible(false);
      hideTimer = window.setTimeout(() => {
        if (!visibleRef.current) {
          setStatus('idle');
          setMessage('');
          setAttempt(undefined);
          setMaxAttempts(undefined);
        }
      }, 250);
    };

    const onWakeup = (event: Event) => {
      const detail = (event as CustomEvent<BackendWakeupEventDetail>).detail;
      window.clearTimeout(readyTimer);
      window.clearTimeout(hideTimer);

      if (detail.status === 'ready') {
        // A successful request should clear any stale warning. If the banner was not visible,
        // stay silent so a healthy backend never flashes a confusing success/wakeup card.
        setStatus('ready');
        setMessage(detail.message ?? 'OpsPilot está listo para recibir consultas.');
        setAttempt(detail.attempt);
        setMaxAttempts(detail.maxAttempts);

        if (visibleRef.current && lastVisibleStatusRef.current !== 'idle') {
          setVisible(true);
          readyTimer = window.setTimeout(hideBanner, 900);
        } else {
          hideBanner();
        }
        return;
      }

      setStatus(detail.status);
      setMessage(detail.message ?? 'Preparando el servicio de OpsPilot...');
      setAttempt(detail.attempt);
      setMaxAttempts(detail.maxAttempts);
      setVisible(true);
    };

    window.addEventListener('opspilot-backend-wakeup', onWakeup);

    // Warm Render silently on page load. This never shows the banner: the UI is reserved
    // for real user actions that fail or clearly need to wait for the backend.
    warmBackend({ attempts: 1, timeoutMs: 3500, showUi: false }).catch(() => undefined);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(hideTimer);
      window.removeEventListener('opspilot-backend-wakeup', onWakeup);
    };
  }, [canWarm]);

  if (!canWarm || !visible || status === 'idle') return null;

  const ready = status === 'ready';
  const offline = status === 'offline';
  const warming = status === 'checking' || status === 'warming';
  const progressLabel = attempt && maxAttempts ? `Intento ${Math.min(attempt, maxAttempts)} de ${maxAttempts}` : 'Comprobando servicio';

  return (
    <div className="fixed bottom-5 left-1/2 z-[90] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 px-2 print:hidden sm:bottom-6">
      <div
        className={cn(
          'premium-border overflow-hidden rounded-3xl shadow-premium',
          ready && 'border-emerald-300/30',
          offline && 'border-amber-300/30'
        )}
      >
        <div className="flex items-start gap-4 p-4 sm:p-5">
          <div
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border',
              ready && 'border-emerald-300/30 bg-emerald-300/[.12] text-emerald-200',
              warming && 'border-emerald-300/25 bg-emerald-300/[.08] text-emerald-200',
              offline && 'border-amber-300/30 bg-amber-300/[.08] text-amber-200'
            )}
          >
            {ready ? <CheckCircle2 className="h-5 w-5" /> : offline ? <WifiOff className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-white">
                {ready ? 'OpsPilot listo' : offline ? 'El backend tardó más de lo esperado' : 'Activando OpsPilot'}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/[.08] px-2 py-1 text-[11px] font-medium text-emerald-200">
                <Cloud className="h-3 w-3" /> Servicio en la nube
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-slate-300">
              {message || 'El servicio gratuito puede tardar unos segundos si estuvo inactivo. Lo estamos preparando antes de continuar.'}
            </p>
            {!ready && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{progressLabel}</span>
                <span className="truncate">Backend: {API_BASE}</span>
              </div>
            )}
          </div>
          {offline && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={() => {
                setStatus('checking');
                setMessage('Reintentando conexión con el backend...');
                setVisible(true);
                warmBackend({ force: true, attempts: 6, timeoutMs: 6500, intervalMs: 2500, showUi: true, displayDelayMs: 0 }).catch(() => undefined);
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          )}
        </div>
        {warming && (
          <div className="h-1 w-full overflow-hidden bg-white/[.04]">
            <div className="h-full w-2/3 animate-[pulse_1.4s_ease-in-out_infinite] rounded-r-full bg-emerald-300" />
          </div>
        )}
      </div>
    </div>
  );
}
