import { Check } from 'lucide-react';
import clsx from 'clsx';
import type { AlertDto, AlertStatus, Instant } from '@/types/api';
import { formatDate, formatDateTime, formatTime } from '@/utils/format';
import { ALERT_STATUSES, alertStatusLabel } from '@/utils/labels';

/** Workflow order as implemented by the backend: NEW → ACKNOWLEDGED → IN_PROGRESS → RESOLVED. */
const STEPS = ALERT_STATUSES;

function stepIndex(s: AlertStatus) {
  return Math.max(0, STEPS.indexOf(s));
}

/** Compact workflow meter for list rows: four segments plus the status in text (never color-only). */
export function AlertWorkflowMeter({ status, className }: { status: AlertStatus; className?: string }) {
  const idx = stepIndex(status);
  const done = status === 'RESOLVED';
  return (
    <span className={clsx('inline-flex min-w-0 items-center gap-2', className)}>
      <span aria-hidden="true" className="flex shrink-0 gap-[3px]">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={clsx(
              'h-[5px] w-3 rounded-[1px]',
              i < idx || done ? 'bg-fg/70' : i === idx ? (status === 'NEW' ? 'bg-accent ring-1 ring-inset ring-accent-ink/40' : 'bg-fg') : 'bg-line',
            )}
          />
        ))}
      </span>
      <span className="truncate text-[0.8125rem] text-fg">
        {alertStatusLabel[status]}
        <span className="sr-only"> (step {idx + 1} of {STEPS.length})</span>
      </span>
    </span>
  );
}

/** When each step was reached, from the alert's own fields and event log (no inferred times). */
function reachedAt(alert: AlertDto): Partial<Record<AlertStatus, Instant>> {
  const inProgress = [...alert.events]
    .filter((e) => e.type === 'STATUS_CHANGED' && /to IN_PROGRESS\b/.test(e.message))
    .sort((a, b) => a.at.localeCompare(b.at))[0]?.at;
  return {
    NEW: alert.createdAt,
    ACKNOWLEDGED: alert.acknowledgedAt ?? undefined,
    IN_PROGRESS: inProgress,
    RESOLVED: alert.resolvedAt ?? undefined,
  };
}

/** Full horizontal stepper for the detail drawer. */
export function AlertWorkflowSteps({ alert }: { alert: AlertDto }) {
  const idx = stepIndex(alert.status);
  const resolved = alert.status === 'RESOLVED';
  const times = reachedAt(alert);
  return (
    <ol aria-label="Alert workflow" className="grid grid-cols-4 gap-px overflow-hidden rounded-sm border border-line bg-line">
      {STEPS.map((s, i) => {
        const state = i < idx || resolved ? 'done' : i === idx ? 'current' : 'upcoming';
        const at = times[s];
        return (
          <li
            key={s}
            aria-current={state === 'current' ? 'step' : undefined}
            className={clsx('relative min-w-0 bg-panel px-2.5 pb-2 pt-2.5', state === 'current' && 'bg-raised/70')}
          >
            <span
              aria-hidden="true"
              className={clsx(
                'absolute inset-x-0 top-0 h-[3px]',
                state === 'done' ? 'bg-fg/70' : state === 'current' ? 'bg-accent' : 'bg-transparent',
              )}
            />
            <span className="flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-[0.06em] text-fg-muted">
              {state === 'done' ? <Check aria-hidden="true" className="h-3 w-3 text-fg" /> : <span aria-hidden="true">{i + 1}</span>}
              <span className="sr-only">{state === 'done' ? 'Done: ' : state === 'current' ? 'Current: ' : 'Upcoming: '}</span>
            </span>
            <span className={clsx('mt-1 block truncate text-xs', state === 'upcoming' ? 'text-fg-muted' : 'font-medium text-fg')}>
              {alertStatusLabel[s]}
            </span>
            <span className="mt-0.5 block truncate font-mono text-[0.625rem] text-fg-muted" title={at ? formatDateTime(at) : undefined}>
              {at && state !== 'upcoming' ? formatTime(at) : '—'}
            </span>
            {at && state !== 'upcoming' && (
              <span className="block truncate font-mono text-[0.625rem] text-fg-muted">{formatDate(at)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
