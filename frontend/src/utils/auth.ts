import { ApiError } from '@/services/apiClient';

/** Only allow same-app relative redirects (prevents open redirects via ?next=). */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) return '/dashboard';
  return next;
}

/** User-facing copy for a failed sign-in. */
export function loginErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Incorrect email or password.';
    if (e.status === 429) return e.message || 'Too many sign-in attempts. Please wait a moment and try again.';
    if (e.status === 0) return 'Unable to reach the PowerPulse server. Check that the backend is running.';
    if (e.status >= 500) return 'The server could not process the sign-in. Try again shortly.';
    return e.message || 'Sign-in failed.';
  }
  return 'Sign-in failed.';
}
