import clsx from 'clsx';
import { formatTime } from '@/utils/format';

/** "Live · updated 14:05:09" for polled lists; the dot pulses while a refetch is in flight. */
export function LiveStamp({ updatedAt, fetching, className }: { updatedAt: number; fetching?: boolean; className?: string }) {
  if (!updatedAt) return null;
  return (
    <p
      className={clsx('inline-flex h-7 items-center gap-2 font-mono text-label uppercase text-fg-muted', className)}
      title="This list refreshes automatically"
    >
      <span
        aria-hidden="true"
        className={clsx('h-1.5 w-1.5 rounded-full bg-healthy', fetching && 'animate-pulse motion-reduce:animate-none')}
      />
      Live · updated <time dateTime={new Date(updatedAt).toISOString()}>{formatTime(updatedAt, true)}</time>
    </p>
  );
}
