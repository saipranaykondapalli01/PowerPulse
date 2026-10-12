import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import type { TransformerDto } from '@/types/api';
import { Freshness } from '@/components/ui/Freshness';
import { HealthGauge } from '@/components/ui/HealthGauge';
import { SeverityBadge, StatusBadge } from '@/components/ui/StatusBadges';
import { formatKva, formatNumber, formatPct, formatTemp } from '@/utils/format';
import { links } from '@/utils/links';

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-fg-muted">{label}</dt>
      <dd className="tabular mt-0.5 font-mono text-[0.8125rem] text-fg">{children}</dd>
    </div>
  );
}

/** Stacked rows for narrow screens: identity, status, health and the key latest readings. */
export function TransformerCardList({ rows, empty }: { rows: TransformerDto[]; empty?: ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <ul aria-label="Transformer registry" className="divide-y divide-line">
      {rows.map((t) => (
        <li key={t.id}>
          <Link
            to={links.transformer(t.id)}
            aria-label={`Open ${t.code} ${t.name}`}
            className="group block px-4 py-3 transition-colors duration-fast hover:bg-raised/50 focus-visible:bg-raised/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-accent-ink">{t.code}</p>
                <p className="truncate text-sm font-medium text-fg">{t.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
                  <MapPin aria-hidden="true" className="h-3 w-3" />
                  {t.location}
                  <span aria-hidden="true">·</span>
                  <span className="tabular font-mono">{formatKva(t.ratedCapacityKva)}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <StatusBadge value={t.status} />
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-fg-muted" />
              </div>
            </div>
            <dl className="mt-2.5 grid grid-cols-4 gap-x-3 gap-y-2">
              <div className="col-span-4 flex items-center justify-between gap-3">
                <dt className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-fg-muted">Health</dt>
                <dd>
                  <HealthGauge score={t.healthScore} status={t.status} />
                </dd>
              </div>
              <Metric label="Temp">{formatTemp(t.latestReading?.temperatureC)}</Metric>
              <Metric label="Oil">{formatPct(t.latestReading?.oilLevelPct)}</Metric>
              <Metric label="Load">{formatPct(t.latestReading?.loadPct)}</Metric>
              <Metric label="Faults">
                {t.activeFaultCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    {t.highestActiveSeverity && <SeverityBadge value={t.highestActiveSeverity} className="hidden min-[400px]:inline-flex" />}
                    {formatNumber(t.activeFaultCount)}
                  </span>
                ) : (
                  <span className="text-fg-muted">0</span>
                )}
              </Metric>
            </dl>
            <div className="mt-2">
              <Freshness at={t.lastReadingAt} stale={t.stale} label="Last reading" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
