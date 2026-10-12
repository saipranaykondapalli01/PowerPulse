import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Info } from 'lucide-react';
import clsx from 'clsx';
import { useTransformerAlerts, useTransformerIncidents, useTransformerMaintenance } from '@/hooks/useMonitoring';
import type { AlertDto, FaultIncidentDto, MaintenanceDto, TransformerDetailDto } from '@/types/api';
import { Badge, SimulatedBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Freshness } from '@/components/ui/Freshness';
import { Panel } from '@/components/ui/Panel';
import { QueryState } from '@/components/ui/QueryState';
import { LoadingBlock } from '@/components/ui/Skeleton';
import {
  AlertStatusBadge,
  MaintenanceStatusBadge,
  OverdueBadge,
  PriorityBadge,
  SeverityBadge,
} from '@/components/ui/StatusBadges';
import { Table, type Column } from '@/components/ui/Table';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelative,
  formatWithUnit,
  isNum,
} from '@/utils/format';
import { faultTypeLabel, readingSourceLabel } from '@/utils/labels';
import { links } from '@/utils/links';

export function PanelLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-fg hover:underline">
      {children}
      <ArrowRight aria-hidden="true" className="h-3 w-3" />
    </Link>
  );
}

/** Label/value pair for metadata grids. */
export function Spec({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={clsx('min-w-0 bg-panel px-4 py-3', className)}>
      <dt className="font-mono text-label uppercase text-fg-muted">{label}</dt>
      <dd className="tabular mt-1 truncate font-mono text-sm text-fg">{value}</dd>
    </div>
  );
}

interface ReadingDef {
  key: 'temperatureC' | 'oilLevelPct' | 'loadPct' | 'voltageV' | 'currentA' | 'powerFactor';
  label: string;
  unit: string;
  digits: number;
}

const READINGS: ReadingDef[] = [
  { key: 'temperatureC', label: 'Top-oil temperature', unit: '°C', digits: 1 },
  { key: 'oilLevelPct', label: 'Oil level', unit: '%', digits: 1 },
  { key: 'loadPct', label: 'Load', unit: '% of rated', digits: 1 },
  { key: 'voltageV', label: 'Voltage (L-L)', unit: 'V', digits: 0 },
  { key: 'currentA', label: 'Current', unit: 'A', digits: 0 },
  { key: 'powerFactor', label: 'Power factor', unit: '', digits: 2 },
];

/** Latest sensor values with units, explicit stale/missing states, timestamp and data source. */
export function CurrentReadings({ t }: { t: TransformerDetailDto }) {
  const r = t.latestReading;
  return (
    <Panel
      eyebrow="Telemetry"
      title="Current readings"
      flush
      actions={
        <span className="flex flex-wrap items-center gap-2">
          {r?.source === 'SIMULATED' ? <SimulatedBadge /> : r ? <Badge tone="neutral">{readingSourceLabel[r.source]}</Badge> : null}
          <Freshness at={t.lastReadingAt} stale={t.stale} label="Last reading" />
        </span>
      }
    >
      {!r ? (
        <EmptyState compact title="No readings yet" description="This transformer has not reported any data." />
      ) : (
        <>
          {t.stale && (
            <p role="status" className="flex items-start gap-2 border-b border-warning/30 bg-warning-bg px-4 py-2.5 text-xs text-warning">
              <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">Stale.</strong> No reading for longer than the {formatDuration(t.sensorTimeoutSeconds)} sensor
                timeout. Values below are the last known reading, not live data.
              </span>
            </p>
          )}
          <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
            {READINGS.map((d) => {
              const v = r[d.key];
              return (
                <div key={d.key} className="min-w-0 bg-panel px-4 py-3">
                  <dt className="font-mono text-label uppercase text-fg-muted">{d.label}</dt>
                  <dd className="mt-1.5 flex items-baseline gap-1">
                    {isNum(v) ? (
                      <>
                        <span className={clsx('tabular font-display text-2xl font-semibold leading-none tracking-tight', t.stale ? 'text-fg-muted' : 'text-fg')}>
                          {formatNumber(v, d.digits)}
                        </span>
                        {d.unit && <span className="font-mono text-xs text-fg-muted">{d.unit}</span>}
                      </>
                    ) : (
                      <span className="font-mono text-xs uppercase text-fg-muted">— Not reported</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="border-t border-line px-4 py-2 font-mono text-[0.6875rem] text-fg-muted">
            Recorded <time dateTime={r.recordedAt}>{formatDateTime(r.recordedAt)}</time> · source {r.source === 'SIMULATED' ? 'PowerPulse simulator' : r.source === 'MANUAL' ? 'manual entry' : 'device'}
          </p>
        </>
      )}
    </Panel>
  );
}

/** Location and nameplate data. */
export function AssetSpecs({ t }: { t: TransformerDetailDto }) {
  return (
    <Panel eyebrow="Nameplate" title="Asset profile" flush>
      <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
        <Spec label="Location" value={<span className="font-sans">{t.location}</span>} />
        <Spec label="Coordinates" value={`${formatNumber(t.latitude, 4)}, ${formatNumber(t.longitude, 4)}`} />
        <Spec label="Rated capacity" value={formatWithUnit(t.ratedCapacityKva, 'kVA', 0)} />
        <Spec label="Primary voltage" value={formatWithUnit(t.primaryVoltageKv, 'kV', 1)} />
        <Spec label="Secondary voltage" value={formatWithUnit(t.secondaryVoltageV, 'V', 0)} />
        <Spec label="Rated current" value={formatWithUnit(t.ratedCurrentA, 'A', 0)} />
        <Spec label="Sensor timeout" value={formatDuration(t.sensorTimeoutSeconds)} />
        <Spec label="Last maintenance" value={t.lastMaintenanceAt ? formatDate(t.lastMaintenanceAt) : 'Never'} />
        <Spec label="Connected units" value={formatNumber(t.connectedTo.length)} />
      </dl>
      <p className="border-t border-line px-4 py-2 font-mono text-[0.6875rem] text-fg-muted">
        Rated current = kVA × 1000 / (√3 × secondary V).
      </p>
    </Panel>
  );
}

/** Active alerts: fault severity from threshold rules. Deliberately separate from the health score. */
export function ActiveAlerts({ id }: { id: string }) {
  const alerts = useTransformerAlerts(id, { active: true });
  const count = alerts.data?.length;
  return (
    <Panel
      eyebrow={count === undefined ? 'Faults' : `Faults · ${formatNumber(count)} active`}
      title="Active faults & alerts"
      description="Severity comes from threshold rules on live readings — independent of the health score."
      flush
      actions={<PanelLink to={links.alertsForTransformer(id)}>All alerts</PanelLink>}
    >
      <QueryState
        query={alerts}
        loading={<LoadingBlock className="p-4" lines={3} />}
        isEmpty={(d: AlertDto[]) => d.length === 0}
        empty={<EmptyState compact title="No active alerts" description="All monitored values are within thresholds." />}
      >
        {(data) => (
          <ul className="divide-y divide-line">
            {data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge value={a.severity} />
                    <Link to={links.alert(a.id)} className="text-sm font-medium text-fg hover:underline">
                      {faultTypeLabel[a.faultType] ?? a.faultType}
                    </Link>
                    <AlertStatusBadge value={a.status} />
                    {a.recovered && <Badge tone="healthy">Recovered</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">{a.description}</p>
                </div>
                <div className="text-right">
                  <p className="tabular font-mono text-xs text-fg">
                    {formatWithUnit(a.measuredValue, a.unit)}
                    <span className="text-fg-muted"> vs limit {formatWithUnit(a.threshold, a.unit)}</span>
                  </p>
                  <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)} className="font-mono text-[0.6875rem] text-fg-muted">
                    Raised {formatRelative(a.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </Panel>
  );
}

export function Recommendations({ t }: { t: TransformerDetailDto }) {
  return (
    <Panel eyebrow="Guidance" title="Suggested inspection actions" flush>
      {t.recommendations.length === 0 ? (
        <EmptyState compact title="No suggested actions" description="No active rule matched this transformer." />
      ) : (
        <ol className="divide-y divide-line">
          {t.recommendations.map((r, i) => (
            <li key={`${r.title}-${i}`} className="flex gap-3 px-4 py-3">
              <span className="tabular mt-0.5 font-mono text-xs text-fg-muted">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">
                  {r.title}
                  {r.faultType && (
                    <span className="ml-2 font-mono text-[0.65rem] font-normal uppercase tracking-[0.06em] text-fg-muted">
                      {faultTypeLabel[r.faultType]}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">{r.action}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="flex items-start gap-2 border-t border-line px-4 py-2.5 text-xs text-fg-muted">
        <Info aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
        Rule-based suggestions to guide an inspection — not a diagnosis. Confirm on site before acting.
      </p>
    </Panel>
  );
}

export function PreviousFaults({ id }: { id: string }) {
  const incidents = useTransformerIncidents(id);
  const columns: Column<FaultIncidentDto>[] = [
    { key: 'type', header: 'Fault', rowHeader: true, cell: (i) => faultTypeLabel[i.faultType] ?? i.faultType },
    { key: 'sev', header: 'Severity', cell: (i) => <SeverityBadge value={i.severity} /> },
    { key: 'start', header: 'Started', cell: (i) => <span className="font-mono text-xs">{formatDateTime(i.startedAt)}</span> },
    {
      key: 'dur',
      header: 'Duration',
      align: 'right',
      cell: (i) => (i.resolvedAt ? formatDuration(i.durationSeconds) : <Badge tone="warning">Ongoing</Badge>),
    },
    { key: 'peak', header: 'Peak', align: 'right', cell: (i) => formatWithUnit(i.peakValue, i.unit) },
    {
      key: 'rec',
      header: 'Recurrences',
      align: 'right',
      cell: (i) => (i.recurrenceCount > 0 ? formatNumber(i.recurrenceCount) : <span className="text-fg-muted">First</span>),
    },
  ];
  return (
    <Panel eyebrow="History" title="Previous faults" flush actions={<PanelLink to={`/fault-history?transformerId=${id}`}>Fault history</PanelLink>}>
      <QueryState query={incidents} loading={<LoadingBlock className="p-4" />}>
        {(data) => (
          <Table
            caption="Fault incidents for this transformer"
            columns={columns}
            rows={data}
            getRowId={(i) => i.id}
            dense
            maxHeight="22rem"
            empty={<EmptyState compact title="No recorded faults" />}
          />
        )}
      </QueryState>
    </Panel>
  );
}

export function MaintenanceHistory({ id }: { id: string }) {
  const tasks = useTransformerMaintenance(id);
  const columns: Column<MaintenanceDto>[] = [
    {
      key: 'title',
      header: 'Task',
      rowHeader: true,
      cell: (m) => (
        <Link to={links.maintenance(m.id)} className="block max-w-[16rem] truncate hover:underline" title={m.title}>
          {m.title}
        </Link>
      ),
    },
    { key: 'priority', header: 'Priority', cell: (m) => <PriorityBadge value={m.priority} /> },
    { key: 'status', header: 'Status', cell: (m) => <MaintenanceStatusBadge value={m.status} /> },
    {
      key: 'due',
      header: 'Due / done',
      cell: (m) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
          {m.completedAt ? `Done ${formatDate(m.completedAt)}` : formatDate(m.dueDate)}
          {m.overdue && <OverdueBadge />}
        </span>
      ),
    },
    { key: 'tech', header: 'Technician', cell: (m) => <span className="text-xs text-fg-muted">{m.assignedTechnicianName ?? 'Unassigned'}</span> },
  ];
  return (
    <Panel eyebrow="Work orders" title="Maintenance history" flush>
      <QueryState query={tasks} loading={<LoadingBlock className="p-4" />}>
        {(data) => (
          <Table
            caption="Maintenance tasks for this transformer"
            columns={columns}
            rows={data}
            getRowId={(m) => m.id}
            dense
            maxHeight="22rem"
            empty={<EmptyState compact title="No maintenance recorded" />}
          />
        )}
      </QueryState>
    </Panel>
  );
}
