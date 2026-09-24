import { Platform } from 'react-native';

/**
 * The web build is served from the same Vercel deployment as the API, so a
 * relative path is correct there. A phone has no such origin and needs the
 * deployment's URL, overridable for anyone pointing at their own.
 */
const DEFAULT_NATIVE_BASE = 'https://workout-app-two-orpin.vercel.app';

export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return Platform.OS === 'web' ? '' : DEFAULT_NATIVE_BASE;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly payload: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

/** A request that never reached the server -- offline, DNS, TLS, timeout. */
export class NetworkError extends Error {
  constructor(message = 'Could not reach the server. Check your connection.') {
    super(message);
  }
}

const TIMEOUT_MS = 20_000;

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const controller = new AbortController();
  // A phone that has drifted out of signal will otherwise hang the UI until
  // the platform's own (much longer) timeout.
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // A proxy or platform error page rather than our API. Report the status
      // instead of surfacing a JSON parse error to the user.
      throw new ApiError(response.status, 'bad_response', `Unexpected response (${response.status}).`);
    }
  }

  if (!response.ok) {
    const payload = (parsed ?? {}) as Record<string, unknown>;
    throw new ApiError(
      response.status,
      typeof payload.error === 'string' ? payload.error : 'error',
      typeof payload.message === 'string' ? payload.message : `Request failed (${response.status}).`,
      payload
    );
  }
  return parsed as T;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: { id: string; email: string };
}

export interface SyncPullResponse {
  revision: number;
  data: Record<string, unknown> | null;
  updatedAt: string | null;
  deviceLabel: string | null;
}

export const authApi = {
  register: (email: string, password: string) =>
    apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: { email, password } }),
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: (token: string) => apiRequest<{ ok: true }>('/api/auth/logout', { method: 'POST', token }),
};

export const syncApi = {
  pull: (token: string) => apiRequest<SyncPullResponse>('/api/sync', { token }),
  push: (token: string, baseRevision: number, data: unknown, deviceLabel: string | null) =>
    apiRequest<{ revision: number }>('/api/sync', {
      method: 'POST',
      token,
      body: { baseRevision, data, deviceLabel },
    }),
};
