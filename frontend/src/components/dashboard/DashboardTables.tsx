import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAllTransformers } from '@/hooks/useMonitoring';
import type { DashboardFilters, IncidentSummary, MaintenanceSummary, Severity, TransformerDto } from '@/types/api';
import { Panel } from '@/components/ui/Panel';
import { Table, useClientSort, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { LoadingBlock } from '@/components/ui/Skeleton';
import {
  AlertStatusBadge,
  MaintenanceStatusBadge,
  OverdueBadge,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
} from '@/components/ui/StatusBadges';
import { HealthGauge } from '@/components/ui/HealthGauge';
import { Freshness } from '@/components/ui/Freshness';
import { faultTypeLabel } from '@/utils/labels';
import { formatDate, formatDateTime, formatNumber, formatPct, formatRelative, formatTemp } from '@/utils/format';
import { links } from '@/utils/links';

const codeLink = 'font-mono text-xs text-accent-ink hover:underline';

function PanelLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-fg hover:underline">
      {children}
      <ArrowRight aria-hidden="true" className="h-3 w-3" />
    </Link>
  );
}

const severityRank: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Critical first, then newest first within a severity. */
export function sortIncidents(rows: IncidentSummary[]): IncidentSummary[] {
  return [...rows].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function RecentAlertsList({ rows }: { rows: IncidentSummary[] }) {
  const sorted = useMemo(() => sortIncidents(rows), [rows]);
  return (
    <Panel
      eyebrow="Alert queue"
      title="Recent alerts"
      description="Most severe first."
      flush
      actions={<PanelLink to="/alerts">All alerts</PanelLink>}
    >
      {sorted.length === 0 ? (
        <EmptyState compact title="No recent alerts" description="Nothing has tripped a threshold." />
      ) : (
        <ul aria-label="Most recent alerts" className="divide-y divide-line">
          {sorted.map((r) => (
            <li key={r.alertId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 sm:grid-cols-[5.25rem_minmax(0,1fr)_auto]">
              <SeverityBadge value={r.severity} className="justify-self-start" />
              <div className="min-w-0">
                <Link to={links.alert(r.alertId)} className="block truncate text-sm text-fg hover:underline">
                  {faultTypeLabel[r.faultType] ?? r.faultType}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 whitespace-nowrap text-xs text-fg-muted">
                  <Link to={links.transformer(r.transformerId)} className={codeLink}>
                    {r.transformerCode}
                  </Link>
                  <span aria-hidden="true">·</span>
                  <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)} className="tabular font-mono">
                    {formatRelative(r.createdAt)}
                  </time>
                </p>
              </div>
              <AlertStatusBadge value={r.status} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function PendingMaintenanceList({ rows }: { rows: MaintenanceSummary[] }) {
  return (
    <Panel
      eyebrow="Work orders"
      title="Pending maintenance"
      description="Open and recently updated tasks."
      flush
      actions={<PanelLink to="/maintenance">All tasks</PanelLink>}
    >
      {rows.length === 0 ? (
        <EmptyState compact title="No pending maintenance" />
      ) : (
        <ul aria-label="Pending and recent maintenance tasks" className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 px-4 py-2.5">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <Link to={links.maintenance(r.id)} className="min-w-0 truncate text-sm text-fg hover:underline" title={r.title}>
                  {r.title}
                </Link>
                <span className="shrink-0 text-right font-mono text-xs text-fg-muted">
                  {r.completedAt ? (
                    <>Done {formatDate(r.completedAt)}</>
                  ) : (
                    <>
                      Due <span className="tabular text-fg">{formatDate(r.dueDate)}</span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                <Link to={links.transformer(r.transformerId)} className={codeLink}>
                  {r.transformerCode}
                </Link>
                <span aria-hidden="true">·</span>
                <span className="truncate">{r.assignedTechnicianName ?? 'Unassigned'}</span>
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  <PriorityBadge value={r.priority} />
                  <MaintenanceStatusBadge value={r.status} />
                  {r.overdue && <OverdueBadge />}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Health score below which a HEALTHY-status unit is still surfaced (mirrors healthTone's warning band). */
export const ATTENTION_HEALTH_THRESHOLD = 70;

/** A transformer needs attention when its status is not HEALTHY or its health score is low. */
export function needsAttention(t: TransformerDto): boolean {
  return t.status !== 'HEALTHY' || t.healthScore < ATTENTION_HEALTH_THRESHOLD;
}

const statusOrder = { CRITICAL: 0, WARNING: 1, OFFLINE: 2, HEALTHY: 3 } as const;
const attentionAccessors: Record<string, (t: TransformerDto) => string | number | null | undefined> = {
  code: (t) => t.code,
  location: (t) => t.location,
  status: (t) => statusOrder[t.status] * 1000 + t.healthScore,
  health: (t) => t.healthScore,
  temp: (t) => t.latestReading?.temperatureC,
  load: (t) => t.latestReading?.loadPct,
  alerts: (t) => t.activeFaultCount,
};

/** Non-healthy or low-health transformers (from the shared all-transformers query), worst first. */
export function AttentionList({ filters }: { filters: DashboardFilters }) {
  const all = useAllTransformers();
  const navigate = useNavigate();
  const inScope = useMemo(
    () =>
      all.data?.filter(
        (t) => (!filters.location || t.location === filters.location) && (!filters.status || t.status === filters.status),
      ),
    [all.data, filters.location, filters.status],
  );
  const attention = useMemo(() => inScope?.filter(needsAttention), [inScope]);
  const { sorted, sort, setSort } = useClientSort(attention, attentionAccessors, { key: 'status', dir: 'asc' });

  const columns: Column<TransformerDto>[] = [
    {
      key: 'code',
      header: 'Transformer',
      sortable: true,
      rowHeader: true,
      cell: (t) => (
        <span className="flex min-w-0 flex-col">
          <Link to={links.transformer(t.id)} className={codeLink}>
            {t.code}
          </Link>
          <span className="max-w-[14rem] truncate text-xs text-fg-muted">
            {t.name}
            <span className="2xl:hidden"> · {t.location}</span>
          </span>
        </span>
      ),
    },
    { key: 'location', header: 'Location', sortable: true, className: 'hidden 2xl:table-cell', cell: (t) => <span className="text-fg-muted">{t.location}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (t) => <StatusBadge value={t.status} /> },
    { key: 'health', header: 'Health', sortable: true, className: 'hidden sm:table-cell', cell: (t) => <HealthGauge score={t.healthScore} status={t.status} /> },
    {
      key: 'temp',
      header: 'Temp',
      sortable: true,
      align: 'right',
      className: 'hidden md:table-cell',
      cell: (t) => formatTemp(t.latestReading?.temperatureC),
    },
    { key: 'load', header: 'Load', sortable: true, align: 'right', className: 'hidden md:table-cell', cell: (t) => formatPct(t.latestReading?.loadPct) },
    {
      key: 'alerts',
      header: 'Alerts',
      sortable: true,
      align: 'right',
      cell: (t) =>
        t.activeFaultCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            {t.highestActiveSeverity && <SeverityBadge value={t.highestActiveSeverity} className="hidden sm:inline-flex" />}
            {formatNumber(t.activeFaultCount)}
          </span>
        ) : (
          <span className="text-fg-muted">0</span>
        ),
    },
    {
      key: 'reading',
      header: 'Reading',
      className: 'hidden xl:table-cell',
      cell: (t) => <Freshness at={t.lastReadingAt} stale={t.stale} bare />,
    },
  ];

  const count = attention?.length;

  return (
    <Panel
      eyebrow={count === undefined ? 'Triage' : `Triage · ${formatNumber(count)} of ${formatNumber(inScope?.length)} units`}
      title="Transformers needing attention"
      description={`Not healthy, or health score below ${ATTENTION_HEALTH_THRESHOLD}. Select a row for the asset profile.`}
      flush
      actions={<PanelLink to="/transformers">View all transformers</PanelLink>}
    >
      <QueryState query={all} loading={<LoadingBlock className="p-4" lines={6} label="Loading transformers" />}>
        {() =>
          inScope && inScope.length === 0 ? (
            <EmptyState compact title="No transformers match these filters" />
          ) : (
            <Table
              caption="Transformers needing attention"
              columns={columns}
              rows={sorted}
              getRowId={(t) => t.id}
              sort={sort}
              onSortChange={setSort}
              onRowClick={(t) => navigate(links.transformer(t.id))}
              rowLabel={(t) => `Open ${t.code} ${t.name}`}
              maxHeight="26rem"
              dense
              empty={
                <EmptyState
                  compact
                  icon={<CheckCircle2 className="text-healthy" />}
                  title="All transformers healthy"
                  description="No unit in scope is degraded, critical or offline."
                />
              }
            />
          )
        }
      </QueryState>
    </Panel>
  );
}
