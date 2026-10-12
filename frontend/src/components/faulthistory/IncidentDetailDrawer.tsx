import { Link } from 'react-router-dom';
import type { FaultIncidentDto } from '@/types/api';
import { Badge, SimulatedBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { SeverityBadge } from '@/components/ui/StatusBadges';
import { Table, type Column } from '@/components/ui/Table';
import { DetailGrid, DrawerSection, MetricStrip, shortId } from '@/components/workflow/DetailBits';
import { formatAmps, formatDateTime, formatDuration, formatPct, formatPf, formatTemp, formatVolts, formatWithUnit } from '@/utils/format';
import { faultTypeLabel, readingSourceLabel } from '@/utils/labels';
import { links } from '@/utils/links';

type Snapshot = FaultIncidentDto['readings'][number];

const readingColumns: Column<Snapshot>[] = [
  { key: 'at', header: 'Recorded', cell: (r) => <span className="font-mono text-xs">{formatDateTime(r.recordedAt)}</span> },
  { key: 'temp', header: 'Temp', align: 'right', cell: (r) => formatTemp(r.temperatureC) },
  { key: 'oil', header: 'Oil', align: 'right', cell: (r) => formatPct(r.oilLevelPct) },
  { key: 'load', header: 'Load', align: 'right', cell: (r) => formatPct(r.loadPct) },
  { key: 'v', header: 'Voltage', align: 'right', cell: (r) => formatVolts(r.voltageV) },
  { key: 'a', header: 'Current', align: 'right', cell: (r) => formatAmps(r.currentA) },
  { key: 'pf', header: 'PF', align: 'right', cell: (r) => formatPf(r.powerFactor) },
  { key: 'src', header: 'Source', cell: (r) => (r.source === 'SIMULATED' ? <SimulatedBadge /> : readingSourceLabel[r.source]) },
];

export interface IncidentDetailDrawerProps {
  focusId: string | undefined;
  incident: FaultIncidentDto | undefined;
  onClose: () => void;
}

/** Incident detail. There is no single-incident endpoint, so the incident must be in the loaded page. */
export function IncidentDetailDrawer({ focusId, incident, onClose }: IncidentDetailDrawerProps) {
  return (
    <Drawer
      open={!!focusId}
      onClose={onClose}
      title={incident ? `${faultTypeLabel[incident.faultType]} · ${incident.transformerCode}` : 'Incident'}
      widthClass="w-[min(40rem,100vw)]"
    >
      {!incident ? (
        <EmptyState
          title="Incident not in the current results"
          description="Adjust the filters, date range or page to find this incident, then open it from the table."
        />
      ) : (
        <>
          <header className="relative border-b border-line px-5 pb-4 pt-4">
            {!incident.resolvedAt && incident.severity === 'CRITICAL' && (
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-critical" />
            )}
            <p className="font-mono text-label uppercase text-fg-muted">
              Incident {shortId(incident.id)} · {incident.transformerCode} · {incident.location}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SeverityBadge value={incident.severity} />
              {incident.resolvedAt ? <Badge tone="healthy">Resolved</Badge> : <Badge tone="warning">Ongoing</Badge>}
              {incident.recurrenceCount > 0 && <Badge tone="warning">Recurrence ×{incident.recurrenceCount}</Badge>}
            </div>
            <MetricStrip
              className="mt-4"
              items={[
                { label: 'Peak', value: formatWithUnit(incident.peakValue, incident.unit) },
                { label: 'Threshold', value: formatWithUnit(incident.threshold, incident.unit) },
                { label: 'Duration', value: incident.resolvedAt ? formatDuration(incident.durationSeconds) : 'Ongoing' },
              ]}
            />
          </header>
          <DrawerSection title="Record">
            <DetailGrid
              items={[
                {
                  label: 'Transformer',
                  value: (
                    <Link to={links.transformer(incident.transformerId)} className="text-accent-ink hover:underline">
                      {incident.transformerCode}
                    </Link>
                  ),
                },
                { label: 'Location', value: incident.location },
                { label: 'Started', value: formatDateTime(incident.startedAt) },
                { label: 'Resolved', value: incident.resolvedAt ? formatDateTime(incident.resolvedAt) : 'Ongoing' },
                {
                  label: 'Alert',
                  value: (
                    <Link to={links.alert(incident.alertId)} className="font-mono text-xs text-accent-ink hover:underline">
                      Alert {shortId(incident.alertId)}
                    </Link>
                  ),
                },
                {
                  label: 'Maintenance',
                  value:
                    incident.maintenanceIds.length === 0 ? (
                      'None'
                    ) : (
                      <span className="flex flex-wrap gap-2">
                        {incident.maintenanceIds.map((id) => (
                          <Link key={id} to={links.maintenance(id)} className="font-mono text-xs text-accent-ink hover:underline">
                            Task {shortId(id)}
                          </Link>
                        ))}
                      </span>
                    ),
                },
              ]}
            />
          </DrawerSection>
          <DrawerSection title="Resolution notes">
            <p className="whitespace-pre-wrap text-sm text-fg">{incident.resolutionNotes || <span className="text-fg-muted">None recorded.</span>}</p>
          </DrawerSection>
          <DrawerSection title="Actions taken">
            {incident.actionsTaken.length === 0 ? (
              <p className="text-xs text-fg-muted">No actions recorded.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-[0.8125rem] leading-relaxed text-fg marker:text-fg-muted">
                {incident.actionsTaken.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </DrawerSection>
          <DrawerSection title={`Readings snapshots (${incident.readings.length})`}>
            <Table
              dense
              caption="Readings captured during the incident"
              columns={readingColumns}
              rows={incident.readings}
              getRowId={(r) => r.recordedAt}
              empty={<EmptyState compact title="No readings captured" />}
            />
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}
