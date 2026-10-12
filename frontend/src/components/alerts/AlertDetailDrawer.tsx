import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Play, Repeat, UserCheck, Wrench } from 'lucide-react';
import { useAlert, useAlertActions } from '@/hooks/useWorkflows';
import { useAssignableUsers } from '@/hooks/useAdmin';
import { useAuth } from '@/context/AuthContext';
import type { AlertDto, Priority, Severity } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState, errorMessage } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { AlertStatusBadge, SeverityBadge } from '@/components/ui/StatusBadges';
import { useToast } from '@/components/ui/Toast';
import { MaintenanceCreateDialog } from '@/components/maintenance/MaintenanceCreateDialog';
import { DetailGrid, DrawerSection, MetricStrip, shortId, Timeline } from '@/components/workflow/DetailBits';
import { AlertWorkflowSteps } from './AlertWorkflow';
import { ResolveAlertDialog } from './ResolveAlertDialog';
import { RecoveredBadge } from './RecoveredBadge';
import { formatDateTime, formatWithUnit } from '@/utils/format';
import { faultTypeLabel, humanize, roleLabel, severityLabel } from '@/utils/labels';
import { links } from '@/utils/links';

/** Default maintenance priority for an alert severity. */
export const PRIORITY_FOR_SEVERITY: Record<Severity, Priority> = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'URGENT',
};

export interface AlertDetailDrawerProps {
  alertId: string | undefined;
  /** Row data from the list, shown immediately while the detail loads. */
  fallback?: AlertDto;
  onClose: () => void;
}

export function AlertDetailDrawer({ alertId, fallback, onClose }: AlertDetailDrawerProps) {
  const detail = useAlert(alertId);
  const alert = detail.data ?? fallback;
  return (
    <Drawer
      open={!!alertId}
      onClose={onClose}
      title={alert ? `${faultTypeLabel[alert.faultType]} · ${alert.transformerCode}` : 'Alert'}
      widthClass="w-[min(36rem,100vw)]"
    >
      {alert ? (
        <AlertDetailBody alert={alert} />
      ) : detail.isError ? (
        <ErrorState error={detail.error} title="Could not load the alert" onRetry={() => void detail.refetch()} retrying={detail.isRefetching} />
      ) : (
        <LoadingBlock className="p-5" lines={8} label="Loading alert" />
      )}
    </Drawer>
  );
}

function AlertDetailBody({ alert }: { alert: AlertDto }) {
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'ENGINEER', 'OPERATOR');
  const canResolve = hasRole('ADMIN', 'ENGINEER');
  const open = alert.status !== 'RESOLVED';
  const actions = useAlertActions();
  const toast = useToast();
  const users = useAssignableUsers(undefined, canOperate && open);
  const [assignee, setAssignee] = useState(alert.assignedUserId ?? '');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  // Synchronous guard against double submits before the pending state re-renders.
  const inFlight = useRef(false);

  useEffect(() => setAssignee(alert.assignedUserId ?? ''), [alert.assignedUserId]);

  const busy = actions.acknowledge.isPending || actions.update.isPending || actions.assign.isPending;

  /** Toasts only after the backend has confirmed (or rejected) the change. */
  const run = async (label: string, failLabel: string, fn: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await fn();
      toast.success(label, `${faultTypeLabel[alert.faultType]} on ${alert.transformerCode}`);
    } catch (e) {
      toast.error(failLabel, errorMessage(e, 'The action could not be completed.'));
    } finally {
      inFlight.current = false;
    }
  };

  const unit = alert.unit;
  const critical = alert.severity === 'CRITICAL' && open;

  return (
    <>
      <header className="relative border-b border-line px-5 pb-4 pt-4">
        {critical && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-critical" />}
        <p className="font-mono text-label uppercase text-fg-muted">
          Alert {shortId(alert.id)} · {severityLabel[alert.severity]} severity
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <SeverityBadge value={alert.severity} />
          <AlertStatusBadge value={alert.status} />
          {!alert.active && alert.status !== 'RESOLVED' && <Badge>Inactive</Badge>}
          {alert.recurrenceCount > 0 && (
            <Badge tone="warning" icon={<Repeat aria-hidden="true" />}>
              Recurrence ×{alert.recurrenceCount}
            </Badge>
          )}
        </div>
        {alert.recovered && alert.status !== 'RESOLVED' && <RecoveredBadge className="mt-2" />}
        <p className="mt-3 text-sm leading-relaxed text-fg">{alert.description}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
          <Link to={links.transformer(alert.transformerId)} className="font-mono font-medium text-accent-ink underline-offset-2 hover:underline">
            {alert.transformerCode}
          </Link>
          <span>{alert.transformerName}</span>
          <span aria-hidden="true">·</span>
          <span>{alert.location}</span>
        </p>
        <MetricStrip
          className="mt-4"
          items={[
            { label: 'Measured', value: formatWithUnit(alert.measuredValue, unit) },
            { label: 'Threshold', value: formatWithUnit(alert.threshold, unit) },
            { label: 'Peak', value: formatWithUnit(alert.peakValue, unit), hint: `Peak severity: ${severityLabel[alert.peakSeverity]}` },
          ]}
        />
      </header>

      <DrawerSection title="Workflow">
        <AlertWorkflowSteps alert={alert} />
      </DrawerSection>

      {open && (canOperate || canResolve) && (
        <DrawerSection title="Actions">
          {alert.recovered && (
            <p className="mb-3 border-l-2 border-healthy pl-3 text-xs text-fg-muted">
              Readings have returned to normal. Someone engaged with this alert, so it stays open until it is resolved with notes.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {canOperate && alert.status === 'NEW' && (
              <Button
                size="sm"
                variant="primary"
                icon={<UserCheck />}
                loading={actions.acknowledge.isPending}
                disabled={busy}
                onClick={() => run('Alert acknowledged', 'Could not acknowledge the alert', () => actions.acknowledge.mutateAsync(alert.id))}
              >
                Acknowledge
              </Button>
            )}
            {canOperate && alert.status === 'ACKNOWLEDGED' && (
              <Button
                size="sm"
                variant="primary"
                icon={<Play />}
                loading={actions.update.isPending}
                disabled={busy}
                onClick={() =>
                  run('Alert marked in progress', 'Could not update the alert', () => actions.update.mutateAsync({ id: alert.id, body: { status: 'IN_PROGRESS' } }))
                }
              >
                Start progress
              </Button>
            )}
            {canResolve && (
              <Button size="sm" variant="secondary" icon={<CheckCircle2 />} disabled={busy} onClick={() => setResolveOpen(true)}>
                Resolve
              </Button>
            )}
            {canResolve && (
              <Button size="sm" variant="secondary" icon={<Wrench />} disabled={busy} onClick={() => setMaintOpen(true)}>
                Create maintenance
              </Button>
            )}
          </div>
          {canOperate && (
            <form
              className="mt-4 flex items-end gap-2 border-t border-line pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!assignee || busy) return;
                void run('Alert assigned', 'Could not assign the alert', () => actions.assign.mutateAsync({ id: alert.id, userId: assignee }));
              }}
            >
              <Field label="Assign to" className="flex-1" hint={users.isError ? 'Could not load users.' : undefined}>
                <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={users.isPending || busy}>
                  <option value="">{users.isPending ? 'Loading…' : 'Select a user'}</option>
                  {(users.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {roleLabel[u.role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="submit"
                size="md"
                variant="secondary"
                loading={actions.assign.isPending}
                disabled={busy || !assignee || assignee === alert.assignedUserId}
              >
                Assign
              </Button>
            </form>
          )}
        </DrawerSection>
      )}

      <DrawerSection title="Details">
        <DetailGrid
          items={[
            { label: 'Detected', value: formatDateTime(alert.createdAt) },
            { label: 'Last updated', value: formatDateTime(alert.updatedAt) },
            {
              label: 'Acknowledged',
              value: alert.acknowledgedAt ? `${formatDateTime(alert.acknowledgedAt)}${alert.acknowledgedBy ? ` · ${alert.acknowledgedBy}` : ''}` : 'Not yet',
            },
            { label: 'Assignee', value: alert.assignedUserName ?? 'Unassigned' },
            ...(alert.recovered && alert.recoveredAt ? [{ label: 'Readings normal since', value: formatDateTime(alert.recoveredAt) }] : []),
            ...(alert.resolvedAt
              ? [
                  { label: 'Resolved', value: `${formatDateTime(alert.resolvedAt)}${alert.resolvedBy ? ` · ${alert.resolvedBy}` : ''}` },
                  { label: 'Resolution notes', value: alert.resolutionNotes ?? '—', wide: true },
                ]
              : []),
          ]}
        />
      </DrawerSection>

      <DrawerSection title="Linked maintenance">
        {alert.maintenanceIds.length === 0 ? (
          <p className="text-xs text-fg-muted">No maintenance tasks linked to this alert.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {alert.maintenanceIds.map((id) => (
              <li key={id}>
                <Link
                  to={links.maintenance(id)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line px-2 font-mono text-xs text-fg hover:border-line-strong hover:bg-raised/60"
                >
                  <Wrench aria-hidden="true" className="h-3 w-3 text-fg-muted" />
                  Task {shortId(id)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DrawerSection>

      <DrawerSection title="Event timeline">
        <Timeline
          items={[...alert.events]
            .sort((a, b) => a.at.localeCompare(b.at))
            .map((ev, i) => ({ key: `${ev.at}-${i}`, at: ev.at, title: humanize(ev.type), detail: ev.message, actor: ev.actor }))}
        />
      </DrawerSection>

      {canResolve && (
        <>
          <ResolveAlertDialog alert={alert} open={resolveOpen} onClose={() => setResolveOpen(false)} />
          <MaintenanceCreateDialog
            open={maintOpen}
            onClose={() => setMaintOpen(false)}
            transformerId={alert.transformerId}
            transformerLabel={`${alert.transformerCode} · ${alert.transformerName}`}
            alertId={alert.id}
            defaultTitle={`Investigate ${alert.faultType} on ${alert.transformerCode}`}
            defaultDescription={alert.description}
            defaultPriority={PRIORITY_FOR_SEVERITY[alert.severity]}
          />
        </>
      )}
    </>
  );
}
