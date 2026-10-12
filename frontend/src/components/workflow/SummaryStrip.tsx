import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Skeleton } from '@/components/ui/Skeleton';
import { toneBg, toneText, type Tone } from '@/components/ui/tone';
import { formatNumber } from '@/utils/format';

export interface SummaryItem {
  key: string;
  label: string;
  /** Count from a real query. Undefined while loading or when unavailable. */
  value: number | undefined;
  loading?: boolean;
  error?: boolean;
  /** Emphasis tone, applied only when value > 0 (icon + rail; the label always carries the meaning). */
  tone?: Tone;
  icon?: ReactNode;
  /** Short qualifier under the value, e.g. "active". */
  hint?: ReactNode;
  /** Applies this count as a filter. */
  onSelect?: () => void;
  /** The list is currently filtered to this count. */
  active?: boolean;
}

export interface SummaryStripProps {
  /** Accessible name, e.g. "Alert counts". */
  label: string;
  items: SummaryItem[];
  /** Scope note shown on the right, e.g. "Live · all transformers". */
  scope?: ReactNode;
  className?: string;
}

/**
 * Compact row of live counts separated by hairlines. Values come from real queries; "—" when unavailable.
 * Cells with onSelect are buttons that apply the matching filter (aria-pressed reflects it).
 */
export function SummaryStrip({ label, items, scope, className }: SummaryStripProps) {
  const cols = items.length;
  return (
    <section aria-label={label} className={clsx('min-w-0 overflow-hidden rounded-sm border border-line bg-panel', className)}>
      {scope && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-1.5">
          <p className="whitespace-nowrap font-mono text-label uppercase text-fg-muted">{label}</p>
          <p className="truncate font-mono text-label uppercase text-fg-muted">{scope}</p>
        </div>
      )}
      <ul
        className={clsx(
          // Hairlines between cells via a 1px gap over the line color.
          'grid grid-cols-2 gap-px bg-line [&>li]:bg-panel',
          cols === 3 && 'sm:grid-cols-3',
          cols === 4 && 'sm:grid-cols-4',
          cols >= 5 && 'sm:grid-cols-5',
          cols % 2 === 1 && '[&>li:last-child]:col-span-2 sm:[&>li:last-child]:col-span-1',
        )}
      >
        {items.map((it) => {
          const emphasised = !!it.tone && (it.value ?? 0) > 0;
          const valueText = it.loading ? undefined : it.error || it.value === undefined ? '—' : formatNumber(it.value);
          const body = (
            <>
              <span
                aria-hidden="true"
                className={clsx(
                  'absolute inset-y-0 left-0 w-[3px] transition-colors duration-fast',
                  emphasised ? toneBg[it.tone!] : 'bg-transparent',
                  it.active && !emphasised && 'bg-fg',
                )}
              />
              <span className="flex items-center gap-1.5 font-mono text-label uppercase text-fg-muted">
                {it.icon && (
                  <span aria-hidden="true" className={clsx('[&>svg]:h-3.5 [&>svg]:w-3.5', emphasised ? toneText[it.tone!] : 'text-fg-muted')}>
                    {it.icon}
                  </span>
                )}
                <span className="truncate">{it.label}</span>
              </span>
              {valueText === undefined ? (
                <Skeleton className="mt-2 h-6 w-12" />
              ) : (
                <span
                  className="mt-1 block font-display text-[1.625rem] font-semibold leading-none tracking-tight text-fg tabular-nums"
                  title={it.error ? 'Count unavailable — the request failed' : undefined}
                >
                  {valueText}
                </span>
              )}
              {it.hint && <span className="mt-1 block truncate text-xs text-fg-muted">{it.hint}</span>}
            </>
          );
          const cls = clsx(
            'relative block h-full w-full min-w-0 px-4 py-3 text-left',
            it.active && 'bg-raised/60',
          );
          return (
            <li key={it.key} className="min-w-0" data-stat={it.key}>
              {it.onSelect ? (
                <button
                  type="button"
                  onClick={it.onSelect}
                  aria-pressed={!!it.active}
                  aria-label={`${it.label}: ${valueText ?? 'loading'}${it.active ? ' (filter applied)' : ''}`}
                  className={clsx(cls, 'transition-colors duration-fast hover:bg-raised/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-fg/40')}
                >
                  {body}
                </button>
              ) : (
                <div className={cls} aria-busy={it.loading || undefined}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
