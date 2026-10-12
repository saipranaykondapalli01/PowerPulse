import clsx from 'clsx';

export interface SkeletonProps {
  className?: string;
  /** Render N stacked line skeletons. */
  lines?: number;
}

/** Loading placeholder. Decorative; wrap regions with aria-busy where content is loading. */
export function Skeleton({ className, lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={clsx('h-4 animate-pulse rounded-sm bg-raised motion-reduce:animate-none', className)}
            style={{ width: `${100 - ((i * 17) % 35)}%` }}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={clsx('h-4 animate-pulse rounded-sm bg-raised motion-reduce:animate-none', className)}
    />
  );
}

/** A loading block with an sr-only status message. */
export function LoadingBlock({ label = 'Loading', className, lines = 4 }: { label?: string; className?: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}…</span>
      <Skeleton lines={lines} />
    </div>
  );
}
