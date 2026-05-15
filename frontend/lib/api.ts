import type { ApiError, CredentialSession } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const PROFILE_KEY = 'opspilot.profile_id';
const SESSION_KEY = 'opspilot.session';

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

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: { allowOkFalse?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const profileId = getStoredProfileId();
  if (profileId) headers.set('X-Credential-Profile-Id', profileId);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  } catch (error) {
    throw new Error(`No pude conectar con el backend en ${API_BASE}. Verifica que FastAPI esté ejecutándose en http://localhost:8000 y vuelve a intentar.`);
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
