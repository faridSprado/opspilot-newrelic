import type { ApiError, CredentialSession } from '@/types';

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const PROFILE_KEY = 'opspilot.profile_id';
const SESSION_KEY = 'opspilot.session';
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const BACKEND_READY_TTL_MS = 2 * 60 * 1000;

let backendReadyAt = 0;
let warmupPromise: Promise<boolean> | null = null;

type BackendWakeupStatus = 'checking' | 'warming' | 'ready' | 'offline';

export type BackendWakeupEventDetail = {
  status: BackendWakeupStatus;
  apiBase: string;
  attempt?: number;
  maxAttempts?: number;
  message?: string;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function isLocalBackend() {
  return /^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(API_BASE);
}

function isDemoPlaceholderBackend() {
  return API_BASE.includes('demo-api.local');
}

export function shouldWarmBackend() {
  return !DEMO_MODE && !isLocalBackend() && !isDemoPlaceholderBackend() && API_BASE.startsWith('http');
}

function emitBackendWakeup(detail: Omit<BackendWakeupEventDetail, 'apiBase'>) {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent<BackendWakeupEventDetail>('opspilot-backend-wakeup', {
      detail: { ...detail, apiBase: API_BASE }
    })
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchBackendHealth(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    return response.ok;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function warmBackend(options: { force?: boolean; attempts?: number; intervalMs?: number; timeoutMs?: number } = {}) {
  if (!isBrowser() || !shouldWarmBackend()) return true;

  const { force = false, attempts = 10, intervalMs = 4500, timeoutMs = 8500 } = options;
  if (!force && Date.now() - backendReadyAt < BACKEND_READY_TTL_MS) return true;
  if (warmupPromise && !force) return warmupPromise;

  warmupPromise = (async () => {
    emitBackendWakeup({
      status: 'checking',
      attempt: 1,
      maxAttempts: attempts,
      message: 'Preparando el servicio de OpsPilot...'
    });

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const ok = await fetchBackendHealth(timeoutMs);
        if (ok) {
          backendReadyAt = Date.now();
          emitBackendWakeup({
            status: 'ready',
            attempt,
            maxAttempts: attempts,
            message: 'OpsPilot está listo para recibir consultas.'
          });
          return true;
        }
      } catch {
        // Render Free can return network errors or 502/503 while the service is waking up.
      }

      if (attempt < attempts) {
        emitBackendWakeup({
          status: 'warming',
          attempt,
          maxAttempts: attempts,
          message: 'El servicio gratuito estaba inactivo. Lo estamos activando automáticamente.'
        });
        await wait(intervalMs);
      }
    }

    emitBackendWakeup({
      status: 'offline',
      attempt: attempts,
      maxAttempts: attempts,
      message: 'No fue posible confirmar el backend todavía. Puedes reintentar en unos segundos.'
    });
    return false;
  })();

  try {
    return await warmupPromise;
  } finally {
    warmupPromise = null;
  }
}

export function getStoredProfileId() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(PROFILE_KEY) ?? window.localStorage.getItem(PROFILE_KEY);
}

export function hasStoredSession() {
  return Boolean(getStoredProfileId());
}

export function getStoredSession(): CredentialSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CredentialSession;
  } catch {
    return null;
  }
}

export function storeProfileId(profileId: string, persist: boolean, session?: CredentialSession) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PROFILE_KEY, profileId);
  if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (persist) {
    window.localStorage.setItem(PROFILE_KEY, profileId);
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(PROFILE_KEY);
    window.localStorage.removeItem(SESSION_KEY);
  }
  window.dispatchEvent(new Event('opspilot-session-changed'));
}

export function clearProfileId() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(PROFILE_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('opspilot-session-changed'));
}

function shouldRetryBackendStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function buildConnectionError() {
  if (isLocalBackend()) {
    return `No pude conectar con el backend en ${API_BASE}. Verifica que FastAPI esté ejecutándose en http://localhost:8000 y vuelve a intentar.`;
  }
  return `No pude conectar con el backend en ${API_BASE}. Si el servicio gratuito estaba inactivo, espera unos segundos y vuelve a intentar.`;
}

async function performApiFetch(path: string, init: RequestInit, headers: Headers) {
  return fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: { allowOkFalse?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const profileId = getStoredProfileId();
  if (profileId) headers.set('X-Credential-Profile-Id', profileId);

  if (path !== '/health' && shouldWarmBackend()) {
    await warmBackend({ attempts: 8 });
  }

  let response: Response;
  try {
    response = await performApiFetch(path, init, headers);
  } catch {
    if (shouldWarmBackend()) {
      const warmed = await warmBackend({ force: true, attempts: 10 });
      if (warmed) {
        try {
          response = await performApiFetch(path, init, headers);
        } catch {
          throw new Error(buildConnectionError());
        }
      } else {
        throw new Error(buildConnectionError());
      }
    } else {
      throw new Error(buildConnectionError());
    }
  }

  if (shouldWarmBackend() && shouldRetryBackendStatus(response.status)) {
    const warmed = await warmBackend({ force: true, attempts: 10 });
    if (warmed) {
      response = await performApiFetch(path, init, headers);
    }
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = payload as ApiError;
    throw new Error(apiError.error?.message ?? `El backend respondió HTTP ${response.status}`);
  }
  if (payload?.ok === false && !options.allowOkFalse) {
    const apiError = payload as Partial<ApiError> & { answer?: string };
    throw new Error(apiError.error?.message ?? apiError.answer ?? 'La operación no se completó. Revisa el mensaje devuelto por el backend.');
  }
  return payload as T;
}

export function apiGet<T>(path: string) {
  return apiRequest<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string) {
  return apiRequest<T>(path, { method: 'DELETE' });
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function apiPostAllowFalse<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }, { allowOkFalse: true });
}
