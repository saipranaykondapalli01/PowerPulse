import { AlertOctagon, RotateCw } from 'lucide-react';
import clsx from 'clsx';
import { ApiError } from '@/services/apiClient';
import { Button } from './Button';

/** Human message for any thrown error (ApiError message, status-specific copy, or fallback). */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Unable to reach the PowerPulse server. Check your connection.';
    if (error.status === 403) return 'You do not have permission to view this.';
    if (error.status === 404) return 'Not found. It may have been removed.';
    if (error.status === 429) return error.message || 'Too many requests. Please wait and try again.';
    if (error.status >= 500) return 'The server failed to process this request. Try again shortly.';
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export interface ErrorStateProps {
  error?: unknown;
  title?: string;
  /** Overrides the derived message. */
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}

/** Inline error with a Retry button. Announced via role="alert". */
export function ErrorState({
  error,
  title = 'Could not load data',
  message,
  onRetry,
  retrying,
  className,
  compact,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center justify-center gap-2 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-10',
        className,
      )}
    >
      <AlertOctagon aria-hidden="true" className="h-6 w-6 text-critical" />
      <p className="font-display text-sm font-semibold text-fg">{title}</p>
      <p className="max-w-sm text-xs text-fg-muted">{message ?? errorMessage(error)}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" icon={<RotateCw />} onClick={onRetry} loading={retrying} className="mt-2">
          Retry
        </Button>
      )}
    </div>
  );
}
