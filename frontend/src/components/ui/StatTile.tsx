import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';
import { toneBg, toneText, type Tone } from './tone';
import { Skeleton } from './Skeleton';

export interface StatTileProps {
  label: string;
  /** Pre-formatted value (string) or number. "—" when unknown. */
  value: ReactNode;
  unit?: string;
  /** Secondary line (e.g. "of 1,200 kVA capacity", formula explanation). */
  hint?: ReactNode;
  /** Small delta/secondary metric shown next to the hint (e.g. "3 critical"). */
  delta?: ReactNode;
  tone?: Tone;
  /** Status icon shown with the label so tone is never color-only. */
  icon?: ReactNode;
  loading?: boolean;
  /** Makes the whole tile a link. */
  to?: string;
  /** Native tooltip with extra explanation (e.g. formula). */
  title?: string;
  /**
   * Optional 0–100 meter under the value (e.g. health score, % of capacity). Decorative:
   * the number it encodes must also be present as text in `value` or `hint`.
   */
  meter?: number | null;
  /**
   * "card" (default): standalone bordered tile.
   * "cell": borderless, for hairline KPI grids where the parent draws the rules.
   */
  variant?: 'card' | 'cell';
  className?: string;
}

/** KPI tile: mono label with status icon, large tabular value with unit, optional meter, context line. */
export function StatTile({
  label,
  value,
  unit,
  hint,
  delta,
  tone = 'neutral',
  icon,
  loading,
  to,
  title,
  meter,
  variant = 'card',
  className,
}: StatTileProps) {
  const m = typeof meter === 'number' && Number.isFinite(meter) ? Math.max(0, Math.min(100, meter)) : null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5 font-mono text-label uppercase text-fg-muted">
          {icon && <span className={clsx('mt-px shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5', toneText[tone])}>{icon}</span>}
          <span className="min-w-0">{label}</span>
        </div>
        {to && (
          <ArrowUpRight
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-fg-muted opacity-40 transition-[opacity,transform] duration-fast ease-out group-hover/tile:-translate-y-px group-hover/tile:translate-x-px group-hover/tile:opacity-100 motion-reduce:transition-none"
          />
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="tabular font-display text-[1.75rem] font-semibold leading-none tracking-tight text-fg sm:text-[2rem]">
            {value}
          </span>
          {unit && <span className="font-mono text-xs text-fg-muted">{unit}</span>}
        </p>
      )}
      {m !== null && !loading && (
        <span aria-hidden="true" className="mt-2.5 block h-1 w-full overflow-hidden rounded-sm bg-raised">
          <span className={clsx('block h-full', tone === 'neutral' ? 'bg-fg/70' : toneBg[tone])} style={{ width: `${m}%` }} />
        </span>
      )}
      {(hint || delta) && (
        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-2 text-xs leading-snug text-fg-muted">
          {delta && <span className={clsx('font-medium', toneText[tone])}>{delta}</span>}
          {hint && <span>{hint}</span>}
        </p>
      )}
    </>
  );
  const cls = clsx(
    'group/tile relative flex min-w-0 flex-col bg-panel px-4 pb-3.5 pt-3',
    variant === 'card' && 'rounded-sm border border-line',
    to && 'transition-colors duration-fast hover:bg-raised/50 focus-visible:z-10',
    className,
  );
  if (to) {
    return (
      <Link to={to} className={cls} title={title} data-stat={label}>
        {body}
      </Link>
    );
  }
  return (
    <div className={cls} title={title} aria-busy={loading || undefined} data-stat={label}>
      {body}
    </div>
  );
}
