import { useEffect, useId, useState } from 'react';
import clsx from 'clsx';
import { detectPreset, presetRange, type DateRange, type RangePreset } from '@/components/ui/DateRangePicker';
import { controlClasses } from '@/components/ui/Input';
import { fromLocalInput, toLocalInput } from '@/utils/format';

const PRESETS: RangePreset[] = ['1h', '24h', '7d', '30d'];

export const RANGE_ORDER_ERROR = 'Start must be before end.';

/** Returns an error message when the range is inverted or empty, otherwise null. */
export function validateRange(r: DateRange): string | null {
  if (r.from && r.to && new Date(r.from).getTime() >= new Date(r.to).getTime()) return RANGE_ORDER_ERROR;
  return null;
}

export interface TimeRangeFilterProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
}

/**
 * Preset segment (All / 1h / 24h / 7d / 30d — same semantics as DateRangePicker) plus labelled
 * start/end inputs. An inverted custom range shows an inline error and is NOT applied.
 * Values are ISO instants; an empty end means "now".
 */
export function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  const uid = useId().replace(/:/g, '');
  const [draftFrom, setDraftFrom] = useState(() => toLocalInput(value.from));
  const [draftTo, setDraftTo] = useState(() => toLocalInput(value.to));
  const [error, setError] = useState<string | null>(null);

  // Re-sync the inputs whenever the applied range changes (preset, reset, URL navigation).
  useEffect(() => {
    setDraftFrom(toLocalInput(value.from));
    setDraftTo(toLocalInput(value.to));
    setError(null);
  }, [value.from, value.to]);

  const active = detectPreset(value);
  const none = !value.from && !value.to;

  const commit = (fromStr: string, toStr: string) => {
    const next: DateRange = { from: fromLocalInput(fromStr), to: fromLocalInput(toStr) };
    const err = validateRange(next);
    setError(err);
    if (!err) onChange(next);
  };

  const chip = (selected: boolean) =>
    clsx(
      'h-full min-w-9 px-2.5 font-mono text-xs transition-colors duration-fast',
      selected ? 'bg-ink text-paper' : 'text-fg-muted hover:bg-raised hover:text-fg',
    );

  const errorId = `${uid}-error`;
  const inputCls = clsx(controlClasses, 'h-9 font-mono text-xs [color-scheme:light]');

  return (
    <fieldset className="flex min-w-0 max-w-full flex-col gap-1.5">
      <legend className="mb-1.5 font-mono text-label uppercase text-fg-muted">Time range</legend>
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <div
          role="group"
          aria-label="Range presets"
          className="flex h-9 items-stretch divide-x divide-line overflow-hidden rounded-sm border border-line bg-canvas"
        >
          <button type="button" aria-pressed={none} className={chip(none)} onClick={() => onChange({})}>
            All
          </button>
          {PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={active === p} className={chip(active === p)} onClick={() => onChange(presetRange(p))}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={`${uid}-from`} className="sr-only">
              Start
            </label>
            <input
              id={`${uid}-from`}
              type="datetime-local"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              value={draftFrom}
              onChange={(e) => {
                setDraftFrom(e.target.value);
                commit(e.target.value, draftTo);
              }}
              className={clsx(inputCls, 'w-[11.25rem]')}
            />
          </div>
          <span aria-hidden="true" className="flex h-9 items-center font-mono text-xs text-fg-muted">
            to
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={`${uid}-to`} className="sr-only">
              End
            </label>
            <input
              id={`${uid}-to`}
              type="datetime-local"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              value={draftTo}
              onChange={(e) => {
                setDraftTo(e.target.value);
                commit(draftFrom, e.target.value);
              }}
              className={clsx(inputCls, 'w-[11.25rem]')}
            />
          </div>
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-critical">
          {error} The previous range is still applied.
        </p>
      )}
    </fieldset>
  );
}
