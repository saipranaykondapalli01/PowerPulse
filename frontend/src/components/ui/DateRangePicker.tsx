import { useId } from 'react';
import clsx from 'clsx';
import type { Instant } from '@/types/api';
import { fromLocalInput, toLocalInput } from '@/utils/format';

export interface DateRange {
  from?: Instant;
  to?: Instant;
}

export type RangePreset = '1h' | '24h' | '7d' | '30d';
export const RANGE_PRESET_MS: Record<RangePreset, number> = {
  '1h': 3600_000,
  '24h': 24 * 3600_000,
  '7d': 7 * 24 * 3600_000,
  '30d': 30 * 24 * 3600_000,
};

/** Range ending now for a preset. */
export function presetRange(p: RangePreset, now = Date.now()): DateRange {
  return { from: new Date(now - RANGE_PRESET_MS[p]).toISOString(), to: undefined };
}

/** Best-effort preset detection: open-ended range whose span matches a preset (±2 min). */
export function detectPreset(r: DateRange, now = Date.now()): RangePreset | null {
  if (!r.from || r.to) return null;
  const span = now - new Date(r.from).getTime();
  for (const [k, ms] of Object.entries(RANGE_PRESET_MS) as [RangePreset, number][]) {
    if (Math.abs(span - ms) < 120_000 + 0.02 * ms) return k;
  }
  return null;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  presets?: RangePreset[];
  /** Show the "All" (no range) option. */
  allowClear?: boolean;
  /** Show the custom from/to inputs (default true). */
  custom?: boolean;
  className?: string;
  label?: string;
}

/** Preset chips (1h/24h/7d/30d) plus two datetime-local inputs. Values are ISO instants; empty `to` means "now". */
export function DateRangePicker({
  value,
  onChange,
  presets = ['1h', '24h', '7d', '30d'],
  allowClear = true,
  custom = true,
  className,
  label = 'Time range',
}: DateRangePickerProps) {
  const uid = useId().replace(/:/g, '');
  const active = detectPreset(value);
  const none = !value.from && !value.to;
  const chip = (selected: boolean) =>
    clsx(
      'h-8 rounded-sm px-2.5 font-mono text-xs transition-colors duration-fast',
      selected ? 'bg-ink text-paper' : 'text-fg-muted hover:bg-raised hover:text-fg',
    );
  return (
    <fieldset className={clsx('flex min-w-0 flex-wrap items-center gap-2', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center gap-0.5 rounded-sm border border-line bg-canvas p-0.5" role="group" aria-label="Range presets">
        {allowClear && (
          <button type="button" aria-pressed={none} className={chip(none)} onClick={() => onChange({})}>
            All
          </button>
        )}
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={active === p}
            className={chip(active === p)}
            onClick={() => onChange(presetRange(p))}
          >
            {p}
          </button>
        ))}
      </div>
      {custom && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`${uid}-from`}>
            From
          </label>
          <input
            id={`${uid}-from`}
            type="datetime-local"
            value={toLocalInput(value.from)}
            max={toLocalInput(value.to) || undefined}
            onChange={(e) => onChange({ ...value, from: fromLocalInput(e.target.value) })}
            className="h-9 min-w-0 rounded-sm border border-line bg-panel px-2 font-mono text-xs text-fg [color-scheme:light]"
          />
          <span aria-hidden="true" className="text-fg-muted">
            →
          </span>
          <label className="sr-only" htmlFor={`${uid}-to`}>
            To
          </label>
          <input
            id={`${uid}-to`}
            type="datetime-local"
            value={toLocalInput(value.to)}
            min={toLocalInput(value.from) || undefined}
            onChange={(e) => onChange({ ...value, to: fromLocalInput(e.target.value) })}
            className="h-9 min-w-0 rounded-sm border border-line bg-panel px-2 font-mono text-xs text-fg [color-scheme:light]"
          />
        </div>
      )}
    </fieldset>
  );
}
