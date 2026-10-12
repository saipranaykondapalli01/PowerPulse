import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import {
  useReportDowntime,
  useReportFaultFrequency,
  useReportIncidentDurations,
  useReportMaintenance,
  useReportSummary,
  useReportTransformerHealth,
} from '@/hooks/useAdmin';
import type {
  DowntimeRow,
  FaultFrequency,
  FaultType,
  IncidentDurationRow,
  MaintenanceReport,
  ReportFilters,
  TransformerHealthReportRow,
} from '@/types/api';
import { BarChart, seriesColors } from '@/components/charts';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { HealthGauge } from '@/components/ui/HealthGauge';
import { Panel } from '@/components/ui/Panel';
import { QueryState } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { MaintenanceStatusBadge, PriorityBadge, StatusBadge } from '@/components/ui/StatusBadges';
import { Table, useClientSort, type Column } from '@/components/ui/Table';
import { toneColor } from '@/components/ui/tone';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate, formatDuration, formatNumber } from '@/utils/format';
import { faultTypeLabel } from '@/utils/labels';
import { links } from '@/utils/links';

const chartLoading = <Skeleton className="h-60 w-full" />;

/** Editorial section divider: mono index, hairline and a short title (mirrors the landing page's SectionIndex). */
export function ReportSectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="mt-2 flex items-center gap-3 font-mono text-label uppercase text-fg-muted">
      <span aria-hidden="true" className="tabular">
        {index}
      </span>
      <span aria-hidden="true" className="h-px w-8 bg-line-strong" />
      <h2 className="font-mono text-label font-medium uppercase text-fg">{title}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

export function SummaryTiles({ filters }: { filters: ReportFilters }) {
  const q = useReportSummary(filters);
  if (q.isError && !q.data) {
    return (
      <Panel>
        <ErrorState compact error={q.error} title="Could not load the report summary" onRetry={() => void q.refetch()} retrying={q.isRefetching} />
      </Panel>
    );
  }
  const s = q.data;
  const loading = q.isPending;
  return (
    <section aria-label="Report summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Transformers" value={formatNumber(s?.transformers)} hint="in scope" loading={loading} />
      <StatTile label="Average health" value={formatNumber(s?.averageHealth)} unit="/ 100" hint="health score" loading={loading} />
      <StatTile
        label="Incidents"
        value={formatNumber(s?.incidents)}
        hint={s ? `${formatNumber(s.resolvedIncidents)} resolved` : undefined}
        loading={loading}
      />
      <StatTile
        label="Time to resolve"
        value={formatDuration(s?.meanTimeToResolveSeconds)}
        hint="mean, resolved incidents"
        title="Mean time to resolve"
        loading={loading}
      />
      <StatTile
        label="Maintenance"
        value={formatNumber(s?.maintenanceCreated)}
        hint={s ? `${formatNumber(s.maintenanceCompleted)} completed` : undefined}
        loading={loading}
      />
      <StatTile
        label="High-risk units"
        value={formatNumber(s?.highRiskTransformers)}
        hint="health < 60 or critical alert"
        title="High-risk transformers"
        tone={s && s.highRiskTransformers > 0 ? 'critical' : 'neutral'}
        icon={s && s.highRiskTransformers > 0 ? <AlertTriangle aria-hidden="true" /> : undefined}
        loading={loading}
      />
    </section>
  );
}

export function FaultFrequencySection({ filters }: { filters: ReportFilters }) {
  const q = useReportFaultFrequency(filters);
  return (
    <Panel title="Fault frequency" eyebrow="Count · per fault type" description="Faults raised per type in the selected range.">
      <QueryState
        query={q}
        isEmpty={(d: FaultFrequency[]) => d.every((f) => f.count === 0)}
        empty={<EmptyState compact title="No faults in this range" />}
        loading={chartLoading}
      >
        {(data) => (
          <BarChart
            horizontal
            label="Fault count and critical count per fault type"
            data={data as unknown as Record<string, unknown>[]}
            categoryKey="faultType"
            categoryFormatter={(v) => faultTypeLabel[v as FaultType] ?? v}
            series={[
              { key: 'count', label: 'All severities', color: seriesColors.primary },
              { key: 'critical', label: 'Critical', color: toneColor.critical },
            ]}
            unit="faults"
            valueLabel="Faults"
            height={260}
          />
        )}
      </QueryState>
    </Panel>
  );
}

const techColumns: Column<MaintenanceReport['byTechnician'][number]>[] = [
  { key: 'name', header: 'Technician', rowHeader: true, cell: (r) => r.technicianName },
  { key: 'assigned', header: 'Assigned', align: 'right', cell: (r) => formatNumber(r.assigned) },
  { key: 'completed', header: 'Completed', align: 'right', cell: (r) => formatNumber(r.completed) },
];

function CountList<T>({ rows, label, render }: { rows: T[]; label: string; render: (r: T) => [ReactNode, number] }) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-label uppercase text-fg-muted">{label}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-fg-muted">None</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => {
            const [name, count] = render(r);
            return (
              <li key={i} className="flex items-center justify-between gap-2 border-b border-line/60 pb-1.5 text-sm last:border-b-0 last:pb-0">
                {name}
                <span className="tabular font-mono text-xs text-fg">{formatNumber(count)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MaintenanceSection({ filters }: { filters: ReportFilters }) {
  const q = useReportMaintenance(filters);
  return (
    <Panel title="Maintenance" eyebrow="Tasks · selected range" description="Completion, status, priority and technician load.">
      <QueryState query={q}>
        {(m) => {
          const completed = m.completedOnTime + m.completedLate;
          const onTimePct = completed ? Math.round((m.completedOnTime / completed) * 100) : null;
          return (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                <StatTile
                  label="On time"
                  title="Completed on time"
                  value={formatNumber(m.completedOnTime)}
                  hint={onTimePct !== null ? `${onTimePct}% of completed` : 'completed'}
                  tone="healthy"
                />
                <StatTile label="Late" title="Completed late" value={formatNumber(m.completedLate)} hint="completed after due" tone={m.completedLate > 0 ? 'warning' : 'neutral'} />
                <StatTile label="Overdue" title="Overdue (open)" value={formatNumber(m.overdueOpen)} hint="still open" tone={m.overdueOpen > 0 ? 'critical' : 'neutral'} />
                <StatTile
                  hint="per completed task"
                  label="Avg completion"
                  value={m.averageCompletionHours === null ? '—' : formatNumber(m.averageCompletionHours, 1)}
                  unit={m.averageCompletionHours === null ? undefined : 'h'}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CountList label="By status" rows={m.byStatus} render={(r) => [<MaintenanceStatusBadge key="b" value={r.status} />, r.count]} />
                <CountList label="By priority" rows={m.byPriority} render={(r) => [<PriorityBadge key="b" value={r.priority} />, r.count]} />
              </div>
              <div>
                <h3 className="mb-2 font-mono text-label uppercase text-fg-muted">By technician</h3>
                <Table
                  dense
                  caption="Maintenance tasks per technician"
                  columns={techColumns}
                  rows={m.byTechnician}
                  getRowId={(r) => r.technicianId}
                  empty={<EmptyState compact title="No assigned tasks in this range" />}
                />
              </div>
            </div>
          );
        }}
      </QueryState>
    </Panel>
  );
}

const healthAccessors = {
  health: (r: TransformerHealthReportRow) => r.healthScore,
  code: (r: TransformerHealthReportRow) => r.code,
  alerts: (r: TransformerHealthReportRow) => r.activeAlerts,
  incidents: (r: TransformerHealthReportRow) => r.incidentsInRange,
};

const healthColumns: Column<TransformerHealthReportRow>[] = [
  {
    key: 'code',
    header: 'Transformer',
    sortable: true,
    rowHeader: true,
    cell: (r) => (
      <span className="flex flex-col">
        <Link to={links.transformer(r.transformerId)} className="font-mono text-xs text-accent-ink hover:underline">
          {r.code}
        </Link>
        <span className="text-[0.7rem] text-fg-muted">
          {r.name} · {r.location}
        </span>
      </span>
    ),
  },
  { key: 'health', header: 'Health', sortable: true, cell: (r) => <HealthGauge score={r.healthScore} status={r.status} /> },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge value={r.status} /> },
  {
    key: 'risk',
    header: 'Risk',
    cell: (r) =>
      r.highRisk ? (
        <Badge tone="critical" icon={<AlertTriangle aria-hidden="true" />}>
          High risk
        </Badge>
      ) : (
        <span className="text-fg-muted">—</span>
      ),
  },
  { key: 'alerts', header: 'Active alerts', sortable: true, align: 'right', cell: (r) => formatNumber(r.activeAlerts) },
  { key: 'incidents', header: 'Incidents', sortable: true, align: 'right', cell: (r) => formatNumber(r.incidentsInRange) },
  { key: 'maint', header: 'Last maintenance', cell: (r) => <span className="font-mono text-xs text-fg-muted">{r.lastMaintenanceAt ? formatDate(r.lastMaintenanceAt) : 'Never'}</span> },
];

export function TransformerHealthSection({ filters }: { filters: ReportFilters }) {
  const q = useReportTransformerHealth(filters);
  const { sorted, sort, setSort } = useClientSort(q.data, healthAccessors, { key: 'health', dir: 'asc' });
  return (
    <Panel
      title="Transformer health"
      eyebrow="Health score · 0–100"
      description="Lowest health first. High risk = health below 60 or an active critical alert."
      flush
    >
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState compact title="No transformers in scope" />} loading={<Skeleton className="m-4 h-40" />}>
        {() => (
          <Table caption="Transformer health report" columns={healthColumns} rows={sorted} getRowId={(r) => r.transformerId} sort={sort} onSortChange={setSort} dense maxHeight="28rem" />
        )}
      </QueryState>
    </Panel>
  );
}

const durationColumns: Column<IncidentDurationRow>[] = [
  { key: 'fault', header: 'Fault type', rowHeader: true, cell: (r) => faultTypeLabel[r.faultType] ?? r.faultType },
  { key: 'count', header: 'Incidents', align: 'right', cell: (r) => formatNumber(r.count) },
  { key: 'avg', header: 'Average', align: 'right', cell: (r) => formatDuration(r.averageSeconds) },
  { key: 'max', header: 'Longest', align: 'right', cell: (r) => formatDuration(r.maxSeconds) },
];

export function IncidentDurationSection({ filters }: { filters: ReportFilters }) {
  const q = useReportIncidentDurations(filters);
  return (
    <Panel title="Incident duration" eyebrow="Duration · resolved incidents" description="Resolved incidents per fault type." flush>
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState compact title="No resolved incidents in this range" />} loading={<Skeleton className="m-4 h-32" />}>
        {(rows) => <Table dense caption="Incident duration by fault type" columns={durationColumns} rows={rows} getRowId={(r) => r.faultType} maxHeight="20rem" />}
      </QueryState>
    </Panel>
  );
}

const downtimeColumns: Column<DowntimeRow>[] = [
  {
    key: 'code',
    header: 'Transformer',
    rowHeader: true,
    cell: (r) => (
      <Link to={links.transformer(r.transformerId)} className="font-mono text-xs text-accent-ink hover:underline">
        {r.code}
      </Link>
    ),
  },
  { key: 'loc', header: 'Location', cell: (r) => <span className="text-fg-muted">{r.location}</span> },
  { key: 'incidents', header: 'Offline incidents', align: 'right', cell: (r) => formatNumber(r.offlineIncidents) },
  { key: 'total', header: 'Total offline', align: 'right', cell: (r) => formatDuration(r.totalOfflineSeconds) },
];

export function DowntimeSection({ filters }: { filters: ReportFilters }) {
  const q = useReportDowntime(filters);
  return (
    <Panel title="Downtime" eyebrow="Offline time · per transformer" description="Offline incidents and total offline time per transformer." flush>
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState compact title="No downtime in this range" />} loading={<Skeleton className="m-4 h-32" />}>
        {(rows) => <Table dense caption="Downtime by transformer" columns={downtimeColumns} rows={rows} getRowId={(r) => r.transformerId} maxHeight="20rem" />}
      </QueryState>
    </Panel>
  );
}
