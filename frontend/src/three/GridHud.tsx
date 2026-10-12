import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { Box, Eye, Map as MapIcon, RotateCcw, ScanEye, LocateFixed, Zap } from 'lucide-react';
import type { TransformerStatus } from '@/types/api';
import { toneChip } from '@/components/ui/tone';
import { StatusIcon, STATUS_TEXT_CLASS } from './StatusIcon';
import type { ViewMode } from './CameraRig';
import {
  STATUS_ORDER,
  formatNumber,
  statusLabel,
  toggleStatus,
  type GridFilter,
  type GridNode,
  type NetworkStats,
} from './utils';

export const FLOW_CAPTION = 'Flow animation is a visualization of simulated load, not a validated power-flow simulation.';

const label = 'font-mono text-label uppercase text-fg-muted';
const panel = 'rounded-sm border border-line bg-panel';

/** Status → tone chip classes (shared light-theme tokens). */
const STATUS_CHIP: Record<TransformerStatus, string> = {
  HEALTHY: toneChip.healthy,
  WARNING: toneChip.warning,
  CRITICAL: toneChip.critical,
  OFFLINE: toneChip.offline,
};

// ---------- Stats ----------
export interface GridStatsProps {
  stats: NetworkStats;
  /** Rendered after filtering, to show "showing N of M". */
  visibleCount?: number;
  className?: string;
}

function Stat({ name, value, className, icon }: { name: string; value: string; className?: string; icon?: ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-1.5 sm:px-4">
      <dt className={clsx(label, 'flex items-center gap-1 whitespace-nowrap')}>
        {icon}
        {name}
      </dt>
      <dd className={clsx('tabular mt-0.5 font-display text-xl font-semibold leading-6 tracking-tight text-fg', className)}>{value}</dd>
    </div>
  );
}

/** Network totals. Numbers come from the dashboard summary when available (same as the dashboard). */
export function GridStats({ stats, visibleCount, className }: GridStatsProps) {
  const loadPct = stats.totalCapacityKva > 0 ? (stats.totalLoadKva / stats.totalCapacityKva) * 100 : null;
  return (
    <section aria-label="Network summary" className={clsx(panel, className)}>
      {/* 1px gaps over a line-colored background draw hairline dividers; 9 cells fill 3 or 9 columns exactly. */}
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-sm bg-line xl:grid-cols-9 [&>div]:bg-panel">
        <Stat name="Total" value={String(stats.total)} />
        {STATUS_ORDER.map((s) => (
          <Stat
            key={s}
            name={statusLabel(s)}
            value={String(stats[s.toLowerCase() as 'healthy' | 'warning' | 'critical' | 'offline'])}
            className={STATUS_TEXT_CLASS[s]}
            icon={<StatusIcon status={s} size={11} className={STATUS_TEXT_CLASS[s]} />}
          />
        ))}
        <Stat name="Net health" value={stats.networkHealth === null ? '—' : `${stats.networkHealth}`} />
        <Stat
          name="Active faults"
          value={String(stats.activeFaults)}
          className={stats.activeFaults > 0 ? 'text-critical' : undefined}
        />
        <Stat
          name="Sim. load"
          value={loadPct === null ? '—' : `${formatNumber(loadPct, 0)}%`}
          icon={<Zap size={11} aria-hidden="true" />}
        />
        <Stat name="Load kVA" value={formatNumber(stats.totalLoadKva, 0)} />
      </dl>
      {visibleCount !== undefined && visibleCount !== stats.total && (
        <p className={clsx(label, 'border-t border-line px-3 py-1.5 sm:px-4')}>
          Showing {visibleCount} of {stats.total} transformers
        </p>
      )}
    </section>
  );
}

// ---------- Controls ----------
export type RenderMode = '3d' | '2d';

export interface GridFilterBarProps {
  filter: GridFilter;
  onFilterChange: (f: GridFilter) => void;
  locations: string[];
  /** Per-status counts shown on the chips. */
  counts?: Partial<Record<TransformerStatus, number>>;
  highlightFaults: boolean;
  onHighlightFaults: (v: boolean) => void;
  className?: string;
}

export interface GridViewControlsProps {
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  canIndividual: boolean;
  onResetCamera: () => void;
  renderMode: RenderMode;
  onRenderMode: (m: RenderMode) => void;
  webglAvailable: boolean;
  className?: string;
}

export type GridControlsProps = GridFilterBarProps & GridViewControlsProps;

const chip =
  'inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 font-mono text-label uppercase transition-colors duration-fast ' +
  'disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';
const chipIdle = 'border-line bg-panel text-fg-muted hover:border-line-strong hover:text-fg';

/** Filters that change what is drawn: status chips, location and fault highlighting. */
export function GridFilterBar({
  filter,
  onFilterChange,
  locations,
  counts,
  highlightFaults,
  onHighlightFaults,
  className,
}: GridFilterBarProps) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="sr-only">Filter by status</legend>
        <span className={clsx(label, 'mr-1 hidden sm:inline')} aria-hidden="true">
          Status
        </span>
        {STATUS_ORDER.map((s) => {
          const on = filter.statuses.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => onFilterChange({ ...filter, statuses: toggleStatus(filter.statuses, s) })}
              className={clsx(chip, on ? STATUS_CHIP[s] : chipIdle)}
            >
              <StatusIcon status={s} size={12} className={STATUS_TEXT_CLASS[s]} />
              {statusLabel(s)}
              {counts?.[s] !== undefined && <span className={clsx('tabular', on ? 'opacity-80' : 'text-fg-muted')}>{counts[s]}</span>}
            </button>
          );
        })}
        {filter.statuses.length > 0 && (
          <button
            type="button"
            onClick={() => onFilterChange({ ...filter, statuses: [] })}
            className={clsx(chip, 'border-transparent text-fg-muted underline-offset-4 hover:text-fg hover:underline')}
          >
            All
          </button>
        )}
      </fieldset>

      <span aria-hidden="true" className="hidden h-5 w-px bg-line md:block" />

      <label className="flex items-center gap-2">
        <span className={label}>Location</span>
        <select
          value={filter.location}
          onChange={(e) => onFilterChange({ ...filter, location: e.target.value })}
          className="h-7 rounded-sm border border-line bg-panel px-2 text-xs text-fg hover:border-line-strong"
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        aria-pressed={highlightFaults}
        onClick={() => onHighlightFaults(!highlightFaults)}
        className={clsx(chip, highlightFaults ? toneChip.critical : chipIdle)}
      >
        <Eye size={12} aria-hidden="true" /> Highlight faults
      </button>
    </div>
  );
}

const seg =
  'inline-flex h-7 items-center gap-1.5 border px-2 font-mono text-label uppercase transition-colors duration-fast ' +
  'disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';

/** Camera and renderer controls: overview / individual, reset, 2D ↔ 3D. */
export function GridViewControls({
  viewMode,
  onViewMode,
  canIndividual,
  onResetCamera,
  renderMode,
  onRenderMode,
  webglAvailable,
  className,
}: GridViewControlsProps) {
  const is3d = renderMode === '3d';
  const segOn = 'z-10 border-ink bg-ink text-paper';
  const segOff = 'border-line bg-panel text-fg-muted hover:text-fg';
  return (
    <div className={clsx('flex flex-wrap items-center gap-1.5 rounded-sm border border-line bg-panel/95 p-1', className)}>
      {is3d && (
        <>
          <div role="group" aria-label="Camera view" className="flex">
            <button
              type="button"
              aria-pressed={viewMode === 'overview'}
              onClick={() => onViewMode('overview')}
              title="Overview"
              className={clsx(seg, 'rounded-l-sm', viewMode === 'overview' ? segOn : segOff)}
            >
              <ScanEye size={12} aria-hidden="true" /> <span className="max-2xl:sr-only">Overview</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'individual'}
              disabled={!canIndividual}
              title={canIndividual ? 'Individual' : 'Select a transformer first'}
              onClick={() => onViewMode('individual')}
              className={clsx(seg, '-ml-px rounded-r-sm', viewMode === 'individual' ? segOn : segOff)}
            >
              <LocateFixed size={12} aria-hidden="true" /> <span className="max-2xl:sr-only">Individual</span>
            </button>
          </div>
          <button type="button" onClick={onResetCamera} title="Reset view" className={clsx(chip, chipIdle)}>
            <RotateCcw size={12} aria-hidden="true" /> <span className="max-2xl:sr-only">Reset view</span>
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => onRenderMode(is3d ? '2d' : '3d')}
        disabled={!is3d && !webglAvailable}
        title={!webglAvailable ? '3D view needs WebGL, which is unavailable in this browser' : is3d ? '2D view' : '3D view'}
        className={clsx(chip, 'border-line bg-panel text-fg hover:border-line-strong')}
      >
        {is3d ? <MapIcon size={12} aria-hidden="true" /> : <Box size={12} aria-hidden="true" />}
        <span className="max-2xl:sr-only">{is3d ? '2D view' : '3D view'}</span>
      </button>
    </div>
  );
}

/** Filters and view controls together (kept for callers that want a single toolbar). */
export function GridControls({ className, ...props }: GridControlsProps) {
  return (
    <div className={clsx(panel, 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-2', className)}>
      <GridFilterBar {...props} />
      <GridViewControls {...props} />
    </div>
  );
}

// ---------- Legend ----------
export function GridLegend({ className, showFlow = true }: { className?: string; showFlow?: boolean }) {
  const item = 'flex items-center gap-1 font-mono text-label uppercase';
  return (
    <section aria-label="Legend" className={clsx('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {/* `contents` lets the caption flow on the same line as the last legend items when there is room. */}
      <ul className="contents">
        {STATUS_ORDER.map((s) => (
          <li key={s} className={clsx(item, STATUS_TEXT_CLASS[s])}>
            <StatusIcon status={s} size={12} />
            {statusLabel(s)}
          </li>
        ))}
        <li className={clsx(item, 'text-critical')}>
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border-2 border-critical" />
          Active fault ring
        </li>
        <li className={clsx(item, 'text-fg-muted')}>
          <span aria-hidden="true" className="inline-block h-0 w-3 border-t border-dashed border-fg-muted" />
          Offline line · no flow
        </li>
        {showFlow && (
          <>
            <li className={clsx(item, 'text-fg-muted')}>
              <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent ring-1 ring-ink/30" />
              Flow ∝ load
            </li>
            <li className={clsx(item, 'text-fg-muted')}>
              <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-warning" />
              Flow · load ≥ 90%
            </li>
          </>
        )}
      </ul>
      {showFlow && <p className="text-[11px] leading-4 text-fg-muted">{FLOW_CAPTION}</p>}
    </section>
  );
}

// ---------- Keyboard-accessible transformer list ----------
export interface TransformerListProps {
  nodes: GridNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  className?: string;
}

const LIST_RANK: Record<TransformerStatus, number> = { CRITICAL: 0, WARNING: 1, OFFLINE: 2, HEALTHY: 3 };

/** Every visible transformer as a button: the non-hover, keyboard path to selection and focus. */
export function TransformerList({ nodes, selectedId, onSelect, onHover, className }: TransformerListProps) {
  // Most urgent first, then by code.
  const sorted = [...nodes].sort((a, b) => LIST_RANK[a.status] - LIST_RANK[b.status] || a.code.localeCompare(b.code));
  const listRef = useRef<HTMLUListElement>(null);
  // Keep the selected row visible inside the scrolling list (e.g. after selecting in the scene or via ?focus=).
  // Scrolls only the list itself, never the page.
  useEffect(() => {
    const ul = listRef.current;
    const row = selectedId ? ul?.querySelector<HTMLElement>('[aria-current="true"]') : null;
    if (!ul || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < ul.scrollTop) ul.scrollTop = top;
    else if (bottom > ul.scrollTop + ul.clientHeight) ul.scrollTop = bottom - ul.clientHeight;
  }, [selectedId]);
  return (
    <nav aria-label="Transformers on the grid" className={clsx(panel, 'flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="font-display text-sm font-semibold tracking-tight text-fg">Transformers</h2>
        <span className={clsx(label, 'tabular')}>{nodes.length} shown · urgent first</span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-3 py-4 text-sm text-fg-muted">No transformers match the current filters.</p>
      ) : (
        <ul ref={listRef} className="relative min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto overscroll-contain">
          {sorted.map((n) => {
            const selected = n.id === selectedId;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelect(n.id)}
                  onMouseEnter={() => onHover?.(n.id)}
                  onMouseLeave={() => onHover?.(null)}
                  onFocus={() => onHover?.(n.id)}
                  onBlur={() => onHover?.(null)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors duration-fast hover:bg-raised/70 focus-visible:bg-raised/70 motion-reduce:transition-none',
                    selected && 'bg-raised shadow-[inset_3px_0_0_rgb(var(--ink))]',
                  )}
                >
                  <StatusIcon status={n.status} size={14} className={clsx('shrink-0', STATUS_TEXT_CLASS[n.status])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs font-semibold text-fg">{n.code}</span>
                    <span className="block truncate text-[11px] text-fg-muted">{n.location}</span>
                  </span>
                  <span className="text-right">
                    <span className={clsx('block font-mono text-[10px] uppercase tracking-[0.08em]', STATUS_TEXT_CLASS[n.status])}>
                      {statusLabel(n.status)}
                    </span>
                    <span className="tabular block font-mono text-[11px] text-fg-muted">
                      {n.status === 'OFFLINE' ? '—' : `H ${Math.round(n.healthScore)}`}
                      {n.activeFaultCount > 0 && (
                        <span className="text-critical">
                          {' '}
                          · {n.activeFaultCount} fault{n.activeFaultCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
