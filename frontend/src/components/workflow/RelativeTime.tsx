import clsx from 'clsx';
import type { Instant } from '@/types/api';
import { formatDateTime, formatRelative } from '@/utils/format';

export interface RelativeTimeProps {
  at: Instant | null | undefined;
  /** Epoch ms used as "now" (pass useNow() from the page so many rows share one timer). */
  now?: number;
  /** Also print the absolute time under the relative one. */
  showAbsolute?: boolean;
  className?: string;
}

/** "12 min ago" with the absolute local time in the title (hover) and a machine-readable dateTime. */
export function RelativeTime({ at, now, showAbsolute, className }: RelativeTimeProps) {
  if (!at) return <span className="text-fg-muted">—</span>;
  const abs = formatDateTime(at);
  return (
    <span className={clsx('flex min-w-0 flex-col', className)}>
      <time dateTime={at} title={abs} className="whitespace-nowrap text-[0.8125rem] text-fg">
        {formatRelative(at, now)}
      </time>
      {showAbsolute && <span className="whitespace-nowrap font-mono text-[0.6875rem] text-fg-muted">{abs}</span>}
    </span>
  );
}
