import type { ReactNode } from 'react';
import { Activity, Boxes, ClipboardList, Gauge, Siren } from 'lucide-react';
import type { DashboardSummary } from '@/types/api';
import { StatTile } from '@/components/ui/StatTile';
import { statusMeta } from '@/components/ui/StatusBadges';
import { healthTone } from '@/components/ui/HealthGauge';
import { formatNumber, formatPct, isNum } from '@/utils/format';
import { statusLabel, TRANSFORMER_STATUSES } from '@/utils/labels';

const NETWORK_HEALTH_FORMULA =
  'Network health = Σ(health score × rated kVA) / Σ(rated kVA), over transformers that are not OFFLINE. Transparent heuristic, not a probability of failure.';

const statusCount = (s: DashboardSummary, status: (typeof TRANSFORMER_STATUSES)[number]) =>
  ({ HEALTHY: s.healthy, WARNING: s.warning, CRITICAL: s.critical, OFFLINE: s.offline })[status];

/** Context copy for a status tile. Attention copy only appears when the count is non-zero. */
function statusContext(status: (typeof TRANSFORMER_STATUSES)[number], count: number | undefined): string | undefined {
  if (!isNum(count) || count === 0) return undefined;
  switch (status) {
    case 'CRITICAL':
      return 'Require immediate attention';
    case 'WARNING':
      return 'Outside normal operating range';
    case 'OFFLINE':
      return 'Not reporting or out of service';
    default:
      return undefined;
  }
}

function Group({ label, children, className }: { label: string; children: ReactNode; className: string }) {
  return (
    <div className="min-w-0">
      <h2 className="mb-2 font-mono text-label uppercase text-fg-muted">{label}</h2>
      {/* Hairline grid: the 1px gap shows the line color between cells. */}
      <div className={`grid gap-px overflow-hidden rounded-sm border border-line bg-line ${className}`}>{children}</div>
    </div>
  );
}

/** KPI tiles. Every number comes from DashboardSummary (backend-computed); nothing is extrapolated. */
export function DashboardKpis({
  summary,
  loading,
  location,
}: {
  summary?: DashboardSummary;
  loading?: boolean;
  /** Active location filter, for the "Transformers" context line. */
  location?: string;
}) {
  const s = summary;
  const loadPct = s && s.totalCapacityKva > 0 ? (s.totalLoadKva / s.totalCapacityKva) * 100 : null;
  return (
    <div className="flex flex-col gap-4" aria-busy={loading || undefined}>
      <Group label="Fleet status" className="grid-cols-2 sm:grid-cols-4 xl:grid-cols-5">
        <StatTile
          variant="cell"
          className="col-span-2 sm:col-span-4 xl:col-span-1"
          label="Transformers"
          icon={<Boxes aria-hidden="true" />}
          value={formatNumber(s?.totalTransformers)}
          hint={location ? `Monitored in ${location}` : 'Across all monitored locations'}
          loading={loading}
          to="/transformers"
        />
        {TRANSFORMER_STATUSES.map((st) => {
          const { Icon, tone } = statusMeta[st];
          const count = s ? statusCount(s, st) : undefined;
          const share = s && s.totalTransformers > 0 && isNum(count) ? `${formatPct((count / s.totalTransformers) * 100)} of fleet` : undefined;
          const context = statusContext(st, count);
          return (
            <StatTile
              variant="cell"
              key={st}
              label={statusLabel[st]}
              icon={<Icon aria-hidden="true" />}
              tone={tone}
              value={formatNumber(count)}
              delta={context}
              hint={share}
              loading={loading}
              to={`/transformers?status=${st}`}
            />
          );
        })}
      </Group>
      <Group label="Operations" className="grid-cols-2 lg:grid-cols-4">
        <StatTile
          variant="cell"
          label="Network health"
          icon={<Gauge aria-hidden="true" />}
          tone={s?.networkHealth == null ? 'offline' : healthTone(s.networkHealth)}
          value={s?.networkHealth == null ? '—' : formatNumber(s.networkHealth)}
          unit="/ 100"
          meter={s?.networkHealth ?? null}
          hint={s?.networkHealth == null ? 'No online transformers to score' : 'Fleet health score · capacity-weighted'}
          title={NETWORK_HEALTH_FORMULA}
          loading={loading}
        />
        <StatTile
          variant="cell"
          label="Total load"
          icon={<Activity aria-hidden="true" />}
          value={formatNumber(s?.totalLoadKva)}
          unit="kVA"
          meter={loadPct}
          hint={
            s
              ? loadPct !== null
                ? `${formatPct(loadPct)} of ${formatNumber(s.totalCapacityKva)} kVA rated capacity`
                : 'No rated capacity online'
              : undefined
          }
          loading={loading}
        />
        <StatTile
          variant="cell"
          label="Active alerts"
          icon={<Siren aria-hidden="true" />}
          tone={s && s.activeCriticalAlerts > 0 ? 'critical' : s && s.activeAlerts > 0 ? 'warning' : 'neutral'}
          value={formatNumber(s?.activeAlerts)}
          delta={s ? `${formatNumber(s.activeCriticalAlerts)} critical` : undefined}
          hint={s ? (s.activeAlerts > 0 ? 'Open in the alert queue' : 'No open alerts') : undefined}
          loading={loading}
          to="/alerts"
        />
        <StatTile
          variant="cell"
          label="Pending maintenance"
          icon={<ClipboardList aria-hidden="true" />}
          tone={s && s.overdueMaintenance > 0 ? 'warning' : 'neutral'}
          value={formatNumber(s?.pendingMaintenance)}
          delta={s ? `${formatNumber(s.overdueMaintenance)} overdue` : undefined}
          hint={s ? 'Open work orders' : undefined}
          loading={loading}
          to="/maintenance"
        />
      </Group>
    </div>
  );
}
