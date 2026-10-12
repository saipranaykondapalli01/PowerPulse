import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Crosshair, ExternalLink, X } from 'lucide-react';
import clsx from 'clsx';
import type { TransformerDto } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { StatusBadge, STATUS_BG_CLASS } from './StatusIcon';
import { formatAge, formatNumber } from './utils';

export interface DetailPanelProps {
  transformer: TransformerDto;
  onClose: () => void;
  onFocus?: () => void;
  /** Tighter layout for the floating overlay inside the viewport (lg+). */
  compact?: boolean;
  className?: string;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-panel px-2 py-1">
      <dt className="truncate font-mono text-[10px] uppercase leading-4 tracking-[0.08em] text-fg-muted">{label}</dt>
      <dd className="tabular truncate font-mono text-[13px] leading-5 text-fg">{value}</dd>
    </div>
  );
}

/** Selected-transformer details for the grid view. Esc or the close button clears the selection. */
export function DetailPanel({ transformer: t, onClose, onFocus, compact = false, className }: DetailPanelProps) {
  const navigate = useNavigate();
  const r = t.latestReading;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const health = t.status === 'OFFLINE' ? '—' : Math.round(t.healthScore);

  return (
    <section
      aria-labelledby="grid-detail-title"
      className={clsx('rounded-sm border border-line bg-panel text-fg shadow-[inset_0_2px_0_rgb(var(--ink))]', className)}
    >
      <header className="flex items-start justify-between gap-2 border-b border-line px-3 pb-2 pt-2.5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase leading-4 tracking-[0.08em] text-fg-muted">Selected transformer</p>
          <h2 id="grid-detail-title" className="truncate font-mono text-base font-semibold leading-6 text-fg">
            {t.code}
          </h2>
          <p className="truncate text-xs text-fg-muted">
            {t.name} · {t.location}
          </p>
        </div>
        <IconButton label="Close details" icon={<X />} size="sm" onClick={onClose} className="-mr-1 -mt-0.5" />
      </header>

      <div className="px-3 pb-3">
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <StatusBadge status={t.status} />
          <span className="font-mono text-label uppercase text-fg-muted">
            Health <span className="tabular font-display text-base font-semibold normal-case text-fg">{health}</span>
            <span className="text-fg-muted">/100</span>
          </span>
        </div>
        <div
          className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-raised"
          role="meter"
          aria-label="Health score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(t.healthScore)}
        >
          <div className={clsx('h-full', STATUS_BG_CLASS[t.status])} style={{ width: `${Math.max(0, Math.min(100, t.healthScore))}%` }} />
        </div>

        <dl
          className={clsx(
            'mt-2.5 grid gap-px overflow-hidden rounded-sm border border-line bg-line',
            compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          <Metric label="Temp" value={formatNumber(r?.temperatureC, 1, ' °C')} />
          <Metric label="Oil" value={formatNumber(r?.oilLevelPct, 0, ' %')} />
          <Metric label="Load" value={formatNumber(r?.loadPct, 0, ' %')} />
          <Metric label="Voltage" value={formatNumber(r?.voltageV, 0, ' V')} />
          <Metric label="Current" value={formatNumber(r?.currentA, 0, ' A')} />
          <Metric label="Rating" value={formatNumber(t.ratedCapacityKva, 0, ' kVA')} />
        </dl>

        <dl className="mt-2.5 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="whitespace-nowrap font-mono text-label uppercase text-fg-muted">Last reading</dt>
            <dd className={clsx('text-right font-mono text-xs', t.stale ? 'text-warning' : 'text-fg')}>
              {formatAge(t.readingAgeSeconds)}
              {t.stale && ' · stale'}
              {r?.source === 'SIMULATED' && <span className="text-fg-muted"> · simulated</span>}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="whitespace-nowrap font-mono text-label uppercase text-fg-muted">Active faults</dt>
            <dd className={clsx('text-right font-mono text-xs', t.activeFaultCount > 0 ? 'text-critical' : 'text-fg')}>
              {t.activeFaultCount}
              {t.highestActiveSeverity && ` · highest ${t.highestActiveSeverity.toLowerCase()}`}
            </dd>
          </div>
        </dl>

        {/* One row of actions; short visible labels, full accessible names. */}
        <div className="mt-2.5 flex gap-1.5 border-t border-line pt-2.5">
          {onFocus && (
            <Button size="sm" variant="secondary" icon={<Crosshair />} onClick={onFocus} aria-label="Focus camera" className="flex-1 px-2">
              Focus
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            icon={<ExternalLink />}
            onClick={() => navigate(`/transformers/${t.id}`)}
            aria-label="View details"
            className="flex-1 px-2"
          >
            Details
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Bell />}
            onClick={() => navigate(`/alerts?transformerId=${encodeURIComponent(t.id)}`)}
            aria-label="View alerts"
            className="flex-1 px-2"
          >
            Alerts
          </Button>
        </div>
      </div>
    </section>
  );
}
