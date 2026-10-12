import { AlertTriangle, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { Instant } from '@/types/api';
import { formatDateTime, formatRelative } from '@/utils/format';
import { useNow } from './useNow';

export interface FreshnessProps {
  /** Timestamp of the last reading. */
  at: Instant | null | undefined;
  /** Backend-computed stale flag (preferred). */
  stale?: boolean;
  /** Prefix label, e.g. "Last reading". */
  label?: string;
  /** Hide the clock icon (dense tables). */
  bare?: boolean;
  className?: string;
}

/**
 * Live relative time ("12 s ago") with absolute time in a tooltip and a visible stale warning
 * (icon + "stale" text, never color alone). Staleness comes from the backend `stale` flag.
 */
export function Freshness({ at, stale, label, bare, className }: FreshnessProps) {
  const now = useNow(1000);
  if (!at) {
    return <span className={clsx('font-mono text-xs text-fg-muted', className)}>{label ? `${label}: ` : ''}never</span>;
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap font-mono text-xs tabular',
        stale ? 'text-warning' : 'text-fg-muted',
        className,
      )}
    >
      {stale ? (
        <AlertTriangle aria-hidden="true" className="h-3 w-3" />
      ) : (
        !bare && <Clock aria-hidden="true" className="h-3 w-3" />
      )}
      {label && <span>{label}:</span>}
      <time dateTime={at} title={formatDateTime(at)}>
        {formatRelative(at, now)}
      </time>
      {stale && <span className="uppercase">· stale</span>}
    </span>
  );
}
