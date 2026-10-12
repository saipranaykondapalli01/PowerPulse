import type { ApiErrorBody, ApiFieldError } from '@/types/api';

/**
 * Centralized HTTP client. Every service module uses this; no component calls fetch directly.
 * - Sends the auth cookie (credentials: 'include').
 * - Echoes the XSRF-TOKEN cookie as X-XSRF-TOKEN on mutating requests (Spring CookieCsrfTokenRepository).
 * - Normalizes errors into ApiError. 401s are broadcast so the auth layer can redirect to /login.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: ApiFieldError[];

  constructor(status: number, code: string, message: string, fieldErrors: ApiFieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const UNAUTHORIZED_EVENT = 'powerpulse:unauthorized';

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: object;
  body?: unknown;
  signal?: AbortSignal;
  /** Do not broadcast UNAUTHORIZED_EVENT on 401 (used by the /auth/me probe). */
  silent401?: boolean;
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

export function buildUrl(path: string, query?: object): string {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as QueryParams)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

let csrfBootstrap: Promise<void> | null = null;

/** Ensures the XSRF-TOKEN cookie exists before the first mutation. */
async function ensureCsrfToken(): Promise<void> {
  if (readCookie('XSRF-TOKEN')) return;
  csrfBootstrap ??= fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' })
    .then(() => undefined)
    .finally(() => {
      csrfBootstrap = null;
    });
  await csrfBootstrap;
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    return new ApiError(
      res.status,
      body.code ?? 'HTTP_ERROR',
      body.message ?? res.statusText,
      body.fieldErrors ?? [],
    );
  } catch {
    return new ApiError(res.status, 'HTTP_ERROR', res.statusText || 'Request failed');
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    await ensureCsrfToken();
    const token = readCookie('XSRF-TOKEN');
    if (token) headers['X-XSRF-TOKEN'] = token;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the PowerPulse server');
  }

  if (res.status === 401 && !options.silent401) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, query?: object, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, query?: object) => request<T>(path, { method: 'POST', body, query }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
};

/** Downloads a file (e.g. CSV export) through the authenticated session. */
export async function downloadFile(path: string, query: object, filename: string): Promise<void> {
  const res = await fetch(buildUrl(path, query), { credentials: 'include' });
  if (res.status === 401) window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  if (!res.ok) throw await toApiError(res);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
