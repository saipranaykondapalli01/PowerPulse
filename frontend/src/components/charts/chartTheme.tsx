import type { ReactNode } from 'react';
import clsx from 'clsx';

/** Chart tokens (read from CSS variables so they follow tokens.css). */
export const chartTheme = {
  grid: 'rgb(var(--line))',
  axis: 'rgb(var(--fg-muted))',
  text: 'rgb(var(--fg-muted))',
  tooltipBg: 'rgb(var(--panel))',
  tooltipBorder: 'rgb(var(--line))',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
};

/**
 * Fixed series colors. Assign in this order and never cycle; status colors
 * (healthy/warning/critical/offline) are reserved for status and thresholds.
 */
export const seriesColors = {
  primary: 'rgb(var(--chart-temp))',
  secondary: 'rgb(var(--chart-load))',
  tertiary: 'rgb(var(--chart-secondary))',
  neutral: 'rgb(var(--chart-neutral))',
} as const;

/** Metric-bound colors: the same metric always uses the same color across every page. */
export const metricColors = {
  temperature: 'rgb(var(--chart-temp))',
  load: 'rgb(var(--chart-load))',
  secondary: 'rgb(var(--chart-secondary))',
  neutral: 'rgb(var(--chart-neutral))',
} as const;

export type MetricColorKey = keyof typeof metricColors;

/**
 * Lighter tint of a metric color, for a secondary series of the SAME metric (e.g. "max" next to
 * "average"). Pair it with `dashed: true` so the two series differ by more than lightness.
 */
export const metricTints: Record<MetricColorKey, string> = {
  temperature: 'rgb(var(--chart-temp) / 0.6)',
  load: 'rgb(var(--chart-load) / 0.6)',
  secondary: 'rgb(var(--chart-secondary) / 0.6)',
  neutral: 'rgb(var(--chart-neutral) / 0.6)',
};

export const axisProps = {
  stroke: chartTheme.grid,
  tick: { fill: chartTheme.text, fontSize: chartTheme.fontSize, fontFamily: chartTheme.fontFamily },
  tickLine: false,
  axisLine: { stroke: chartTheme.grid },
} as const;

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

/** HTML legend (identity never color-alone: dashed/solid swatch + text). */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <ul className={clsx('flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted', className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="18"
              y2="3"
              stroke={it.color}
              strokeWidth="2"
              strokeDasharray={it.dashed ? '4 3' : undefined}
            />
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Tooltip shell used by all charts. */
export function TooltipCard({ title, rows }: { title: ReactNode; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="min-w-[10rem] rounded-sm border border-line bg-panel px-3 py-2 text-xs text-fg shadow-overlay">
      <p className="mb-1 font-mono text-label uppercase text-fg-muted">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-muted">
              {r.color && (
                <svg width="12" height="6" aria-hidden="true">
                  <line x1="0" y1="3" x2="12" y2="3" stroke={r.color} strokeWidth="2" strokeDasharray={r.dashed ? '3 2' : undefined} />
                </svg>
              )}
              {r.label}
            </span>
            <span className="tabular font-mono">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Fixed-height frame; Recharts' ResponsiveContainer needs a sized parent.
 * `caption` renders a short visible text summary (e.g. latest values) as the figure's <figcaption>.
 */
export function ChartFrame({
  height = 240,
  children,
  label,
  caption,
}: {
  height?: number;
  children: ReactNode;
  label: string;
  caption?: ReactNode;
}) {
  return (
    <figure className="m-0 min-w-0" aria-label={label}>
      <div style={{ height }} className="w-full min-w-0">
        {children}
      </div>
      {caption && <figcaption className="mt-2 font-mono text-[0.6875rem] leading-4 text-fg-muted">{caption}</figcaption>}
    </figure>
  );
}
