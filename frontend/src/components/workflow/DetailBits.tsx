import type { ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';
import clsx from 'clsx';
import type { Instant } from '@/types/api';
import { formatDateTime } from '@/utils/format';

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Span both columns. */
  wide?: boolean;
}

/** Compact two-column definition list for drawers. */
export function DetailGrid({ items, className }: { items: DetailItem[]; className?: string }) {
  return (
    <dl className={clsx('grid grid-cols-2 gap-x-5 gap-y-3.5', className)}>
      {items.map((it) => (
        <div key={it.label} className={clsx('min-w-0', it.wide && 'col-span-2')}>
          <dt className="font-mono text-label uppercase text-fg-muted">{it.label}</dt>
          <dd className="mt-0.5 break-words text-[0.8125rem] leading-snug text-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Titled section inside a drawer body. */
export function DrawerSection({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('border-b border-line px-5 py-4 last:border-b-0', className)} aria-label={title}>
      <div className="mb-3 flex min-h-7 items-center justify-between gap-2">
        <h3 className="font-mono text-label uppercase text-fg-muted">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export interface MetricCell {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

/** Row of key readings separated by hairlines (e.g. measured / threshold / peak). */
export function MetricStrip({ items, className }: { items: MetricCell[]; className?: string }) {
  return (
    <dl
      className={clsx(
        'grid gap-px overflow-hidden rounded-sm border border-line bg-line',
        items.length === 2 ? 'grid-cols-2' : items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3',
        className,
      )}
    >
      {items.map((m) => (
        <div key={m.label} className="min-w-0 bg-panel px-3 py-2.5">
          <dt className="font-mono text-label uppercase text-fg-muted">{m.label}</dt>
          <dd className="mt-1 truncate font-display text-lg font-semibold leading-tight tracking-tight text-fg tabular-nums">{m.value}</dd>
          {m.hint && <dd className="mt-0.5 truncate text-[0.6875rem] text-fg-muted">{m.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export interface TimelineEntry {
  key: string;
  at: Instant;
  title: ReactNode;
  detail?: ReactNode;
  actor?: string | null;
}

/** Vertical event timeline (oldest first). The latest entry is marked. */
export function Timeline({ items, emptyText = 'No events yet.' }: { items: TimelineEntry[]; emptyText?: string }) {
  if (items.length === 0) return <p className="text-xs text-fg-muted">{emptyText}</p>;
  return (
    <ol className="relative ml-1">
      {items.map((e, i) => {
        const last = i === items.length - 1;
        return (
          <li key={e.key} className="relative pb-4 pl-5 last:pb-0">
            {!last && <span aria-hidden="true" className="absolute bottom-0 left-[3.5px] top-3 w-px bg-line" />}
            <span
              aria-hidden="true"
              className={clsx(
                'absolute left-0 top-[5px] h-2 w-2 rounded-full border',
                last ? 'border-fg bg-fg' : 'border-line-strong bg-panel',
              )}
            />
            <p className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] font-medium text-fg">
              {e.title}
              {last && <span className="font-mono text-[0.625rem] font-normal uppercase tracking-[0.06em] text-fg-muted">Latest</span>}
            </p>
            {e.detail && <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">{e.detail}</p>}
            <p className="mt-1 font-mono text-[0.6875rem] text-fg-muted">
              <time dateTime={e.at}>{formatDateTime(e.at)}</time>
              {e.actor ? ` · ${e.actor}` : ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Inline form-level error banner. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-sm border border-critical/40 bg-critical-bg px-3 py-2 text-sm text-critical">
      <AlertOctagon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

/** Short, readable id for cross-links ("#a1b2c3"). */
export function shortId(id: string): string {
  return `#${id.slice(-6)}`;
}
