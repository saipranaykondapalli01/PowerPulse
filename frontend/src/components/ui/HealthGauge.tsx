import clsx from 'clsx';
import type { TransformerStatus } from '@/types/api';
import { isNum } from '@/utils/format';
import { toneBg, toneText, type Tone } from './tone';

const statusTone: Record<TransformerStatus, Tone> = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  OFFLINE: 'offline',
};

/**
 * Display tone for a health score. Prefer the backend status when available;
 * the score bands mirror the documented status derivation (<40 critical, <70 warning).
 */
export function healthTone(score: number | null | undefined, status?: TransformerStatus): Tone {
  if (status) return statusTone[status];
  if (!isNum(score)) return 'offline';
  if (score < 40) return 'critical';
  if (score < 70) return 'warning';
  return 'healthy';
}

export interface HealthGaugeProps {
  score: number | null | undefined;
  status?: TransformerStatus;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the numeric label (bar only). */
  barOnly?: boolean;
  className?: string;
}

/** Health score 0–100 as number + horizontal meter (role="meter"). */
export function HealthGauge({ score, status, size = 'sm', barOnly, className }: HealthGaugeProps) {
  const tone = healthTone(score, status);
  const v = isNum(score) ? Math.max(0, Math.min(100, score)) : null;
  return (
    <div
      role="meter"
      aria-label="Health score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v ?? undefined}
      aria-valuetext={v === null ? 'No score' : `${v} out of 100`}
      className={clsx('flex min-w-0 items-center', size === 'lg' ? 'flex-col items-start gap-2' : 'gap-2', className)}
    >
      {!barOnly && (
        <span
          className={clsx(
            'tabular font-display font-semibold leading-none',
            toneText[tone],
            size === 'sm' && 'w-7 text-right text-sm',
            size === 'md' && 'text-xl',
            size === 'lg' && 'text-metric',
          )}
        >
          {v ?? '—'}
          {size === 'lg' && <span className="ml-1 font-mono text-sm font-normal text-fg-muted">/ 100</span>}
        </span>
      )}
      <span
        aria-hidden="true"
        className={clsx(
          'relative block overflow-hidden rounded-sm bg-raised',
          size === 'sm' ? 'h-1.5 w-14' : size === 'md' ? 'h-2 w-28' : 'h-2.5 w-full',
        )}
      >
        <span className={clsx('absolute inset-y-0 left-0', toneBg[tone])} style={{ width: `${v ?? 0}%` }} />
      </span>
    </div>
  );
}
