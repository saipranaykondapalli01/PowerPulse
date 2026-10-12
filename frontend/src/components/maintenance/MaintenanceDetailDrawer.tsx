import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { useMaintenanceActions, useMaintenanceTask } from '@/hooks/useWorkflows';
import { useAssignableUsers } from '@/hooks/useAdmin';
import { useAuth } from '@/context/AuthContext';
import type { MaintenanceDto, MaintenanceUpdateRequest, Priority } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState, errorMessage } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { MaintenanceStatusBadge, OverdueBadge, PriorityBadge } from '@/components/ui/StatusBadges';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { DetailGrid, DrawerSection, MetricStrip, shortId, Timeline } from '@/components/workflow/DetailBits';
import { CancelTaskDialog, CompleteTaskDialog } from './TaskDialogs';
import { formatDate, formatDateTime, formatNumber, formatRelative, formatTime, fromLocalInput, toLocalInput } from '@/utils/format';
import { humanize, PRIORITIES, priorityLabel } from '@/utils/labels';
import { links } from '@/utils/links';

export interface MaintenanceDetailDrawerProps {
  taskId: string | undefined;
  fallback?: MaintenanceDto;
  onClose: () => void;
}

export function MaintenanceDetailDrawer({ taskId, fallback, onClose }: MaintenanceDetailDrawerProps) {
  const detail = useMaintenanceTask(taskId);
  const task = detail.data ?? fallback;
  return (
    <Drawer open={!!taskId} onClose={onClose} title={task ? task.title : 'Maintenance task'} widthClass="w-[min(36rem,100vw)]">
      {task ? (
        <TaskBody task={task} />
      ) : detail.isError ? (
        <ErrorState error={detail.error} title="Could not load the task" onRetry={() => void detail.refetch()} retrying={detail.isRefetching} />
      ) : (
        <LoadingBlock className="p-4" lines={8} label="Loading task" />
      )}
    </Drawer>
  );
}

function TaskBody({ task }: { task: MaintenanceDto }) {
  const { user, hasRole } = useAuth();
  const isManager = hasRole('ADMIN', 'ENGINEER');
  const isAssignedTech = user?.role === 'TECHNICIAN' && !!task.assignedTechnicianId && user.id === task.assignedTechnicianId;
  const canProgress = isManager || isAssignedTech;
  const terminal = task.status === 'COMPLETED' || task.status === 'CANCELLED';
  const { update } = useMaintenanceActions();
  const toast = useToast();
  const technicians = useAssignableUsers('TECHNICIAN', isManager && !terminal);

  const [pending, setPending] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [technicianId, setTechnicianId] = useState(task.assignedTechnicianId ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [due, setDue] = useState(toLocalInput(task.dueDate));
  const [note, setNote] = useState('');
  const [findings, setFindings] = useState(task.inspectionFindings ?? '');
  const [part, setPart] = useState({ name: '', quantity: '1', notes: '' });
  const [partError, setPartError] = useState<string>();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  useEffect(() => setTechnicianId(task.assignedTechnicianId ?? ''), [task.assignedTechnicianId]);
  useEffect(() => setPriority(task.priority), [task.priority]);
  useEffect(() => setDue(toLocalInput(task.dueDate)), [task.dueDate]);
  useEffect(() => setFindings(task.inspectionFindings ?? ''), [task.inspectionFindings]);

  const patch = async (key: string, body: MaintenanceUpdateRequest, success: string, fail: string): Promise<boolean> => {
    // Synchronous guard: one change at a time, even before the pending state re-renders.
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(key);
    try {
      await update.mutateAsync({ id: task.id, body });
      toast.success(success, task.title);
      return true;
    } catch (e) {
      toast.error(fail, errorMessage(e, 'The change could not be saved.'));
      return false;
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const submitNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    if (await patch('note', { addWorkNote: note.trim() }, 'Work note added', 'Could not add the note')) setNote('');
  };

  const submitPart = async (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(part.quantity);
    if (!part.name.trim()) return setPartError('Part name is required');
    if (!Number.isInteger(qty) || qty < 1) return setPartError('Quantity must be a whole number of at least 1');
    setPartError(undefined);
    const ok = await patch(
      'part',
      { addPart: { name: part.name.trim(), quantity: qty, notes: part.notes.trim() || null } },
      'Part recorded',
      'Could not record the part',
    );
    if (ok) setPart({ name: '', quantity: '1', notes: '' });
  };

  const dueIso = fromLocalInput(due);

  return (
    <>
      <header className="relative border-b border-line px-5 pb-4 pt-4">
        {task.overdue && !terminal && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-critical" />}
        <p className="font-mono text-label uppercase text-fg-muted">
          Task {shortId(task.id)} · created by {task.createdByName}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <MaintenanceStatusBadge value={task.status} />
          <PriorityBadge value={task.priority} />
          {task.overdue && !terminal && <OverdueBadge />}
        </div>
        {task.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{task.description}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
          <Link to={links.transformer(task.transformerId)} className="font-mono font-medium text-accent-ink underline-offset-2 hover:underline">
            {task.transformerCode}
          </Link>
          <span>{task.transformerName}</span>
          <span aria-hidden="true">·</span>
          <span>{task.location}</span>
        </p>
        <MetricStrip
          className="mt-4"
          items={[
            {
              label: 'Due',
              value: <span className={task.overdue && !terminal ? 'text-critical' : undefined}>{formatDate(task.dueDate)}</span>,
              hint: `${formatTime(task.dueDate)}${terminal ? '' : ` · ${formatRelative(task.dueDate)}`}`,
            },
            { label: 'Technician', value: <span className="text-base">{task.assignedTechnicianName ?? 'Unassigned'}</span> },
            {
              label: 'Work log',
              value: `${formatNumber(task.workNotes.length)} / ${formatNumber(task.partsReplaced.length)}`,
              hint: 'notes / parts',
            },
          ]}
        />
        {terminal && (
          <p className="mt-3 border-l-2 border-line-strong pl-3 text-xs text-fg-muted">
            This task is {task.status === 'COMPLETED' ? 'completed' : 'cancelled'} and read-only.
          </p>
        )}
      </header>

      <DrawerSection title="Details">
        <DetailGrid
          items={[
            {
              label: 'Due',
              value: (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {formatDateTime(task.dueDate)}
                  {task.overdue && !terminal && <OverdueBadge />}
                </span>
              ),
            },
            {
              label: 'Related alert',
              value: task.alertId ? (
                <Link to={links.alert(task.alertId)} className="font-mono text-xs text-accent-ink hover:underline">
                  Alert {shortId(task.alertId)}
                </Link>
              ) : (
                'None'
              ),
            },
            { label: 'Created', value: `${formatDateTime(task.createdAt)} · ${task.createdByName}` },
            { label: 'Last updated', value: formatDateTime(task.updatedAt) },
            ...(task.completedAt ? [{ label: 'Completed', value: formatDateTime(task.completedAt) }] : []),
            ...(task.cancelledAt
              ? [
                  { label: 'Cancelled', value: formatDateTime(task.cancelledAt) },
                  { label: 'Cancel reason', value: task.cancelReason ?? '—', wide: true },
                ]
              : []),
          ]}
        />
      </DrawerSection>

      {!terminal && canProgress && (task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS') && (
        <DrawerSection title="Progress">
          <div className="flex flex-wrap gap-2">
            {task.status === 'ASSIGNED' && (
              <Button
                size="sm"
                variant="primary"
                icon={<Play />}
                loading={pending === 'start'}
                disabled={!!pending}
                onClick={() => void patch('start', { status: 'IN_PROGRESS' }, 'Task started', 'Could not start the task')}
              >
                Start work
              </Button>
            )}
            {task.status === 'IN_PROGRESS' && (
              <Button size="sm" variant="primary" icon={<CheckCircle2 />} disabled={!!pending} onClick={() => setCompleteOpen(true)}>
                Complete
              </Button>
            )}
          </div>
        </DrawerSection>
      )}

      {!terminal && isManager && (
        <DrawerSection
          title="Manage"
          actions={
            <Button size="sm" variant="danger" icon={<XCircle />} disabled={!!pending} onClick={() => setCancelOpen(true)}>
              Cancel task
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (technicianId) void patch('assign', { assignedTechnicianId: technicianId }, 'Technician assigned', 'Could not assign the technician');
              }}
            >
              <Field label="Technician" className="flex-1" hint={technicians.isError ? 'Could not load technicians.' : undefined}>
                <Select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} disabled={technicians.isPending}>
                  <option value="">{technicians.isPending ? 'Loading…' : 'Select a technician'}</option>
                  {(technicians.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.region ? ` · ${u.region}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="submit"
                variant="secondary"
                loading={pending === 'assign'}
                disabled={!!pending || !technicianId || technicianId === task.assignedTechnicianId}
              >
                Assign
              </Button>
            </form>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void patch('priority', { priority }, 'Priority updated', 'Could not change the priority');
              }}
            >
              <Field label="Priority" className="flex-1">
                <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="secondary" loading={pending === 'priority'} disabled={!!pending || priority === task.priority}>
                Save
              </Button>
            </form>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (dueIso) void patch('due', { dueDate: dueIso }, 'Due date updated', 'Could not change the due date');
              }}
            >
              <Field label="Due date" className="flex-1" error={due && !dueIso ? 'Enter a valid date and time' : undefined}>
                <Input type="datetime-local" className="[color-scheme:light]" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                loading={pending === 'due'}
                disabled={!!pending || !dueIso || toLocalInput(dueIso) === toLocalInput(task.dueDate)}
              >
                Save
              </Button>
            </form>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Inspection findings">
        {!terminal && canProgress ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (findings.trim()) void patch('findings', { inspectionFindings: findings.trim() }, 'Findings saved', 'Could not save the findings');
            }}
          >
            <Field label="Findings" hideLabel>
              <Textarea rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="What did the inspection find?" />
            </Field>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                loading={pending === 'findings'}
                disabled={!!pending || !findings.trim() || findings.trim() === (task.inspectionFindings ?? '')}
              >
                Save findings
              </Button>
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-fg">{task.inspectionFindings || <span className="text-fg-muted">None recorded.</span>}</p>
        )}
      </DrawerSection>

      <DrawerSection title={`Work notes (${task.workNotes.length})`}>
        {task.workNotes.length === 0 ? (
          <p className="mb-3 text-xs text-fg-muted">No work notes yet.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {[...task.workNotes]
              .sort((a, b) => a.at.localeCompare(b.at))
              .map((n, i) => (
                <li key={`${n.at}-${i}`} className="rounded-sm border border-line bg-canvas px-3 py-2">
                  <p className="whitespace-pre-wrap text-sm text-fg">{n.text}</p>
                  <p className="mt-1 font-mono text-[0.7rem] text-fg-muted">
                    {n.authorName} · <time dateTime={n.at}>{formatDateTime(n.at)}</time>
                  </p>
                </li>
              ))}
          </ul>
        )}
        {!terminal && canProgress && (
          <form className="flex flex-col gap-2" onSubmit={submitNote}>
            <Field label="Add work note">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="secondary" loading={pending === 'note'} disabled={!!pending || !note.trim()}>
                Add note
              </Button>
            </div>
          </form>
        )}
      </DrawerSection>

      <DrawerSection title={`Parts replaced (${task.partsReplaced.length})`}>
        {task.partsReplaced.length === 0 ? (
          <p className="mb-3 text-xs text-fg-muted">No parts recorded.</p>
        ) : (
          <ul className="mb-3 divide-y divide-line rounded-sm border border-line">
            {task.partsReplaced.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  {p.name}
                  {p.notes && <span className="block text-xs text-fg-muted">{p.notes}</span>}
                </span>
                <span className="tabular shrink-0 font-mono text-xs text-fg-muted">× {formatNumber(p.quantity)}</span>
              </li>
            ))}
          </ul>
        )}
        {!terminal && canProgress && (
          <form className="grid grid-cols-[1fr_5rem] gap-2" onSubmit={submitPart} aria-label="Add part" noValidate>
            <Field label="Part name" required error={partError && !part.name.trim() ? partError : undefined}>
              <Input value={part.name} onChange={(e) => setPart({ ...part, name: e.target.value })} />
            </Field>
            <Field label="Qty" required error={partError && part.name.trim() ? partError : undefined}>
              <Input type="number" min={1} step={1} inputMode="numeric" value={part.quantity} onChange={(e) => setPart({ ...part, quantity: e.target.value })} />
            </Field>
            <Field label="Part notes" className="col-span-2">
              <Input value={part.notes} onChange={(e) => setPart({ ...part, notes: e.target.value })} />
            </Field>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" size="sm" variant="secondary" loading={pending === 'part'} disabled={!!pending}>
                Add part
              </Button>
            </div>
          </form>
        )}
      </DrawerSection>

      <DrawerSection title="History">
        <Timeline
          items={[...task.history]
            .sort((a, b) => a.at.localeCompare(b.at))
            .map((h, i) => ({ key: `${h.at}-${i}`, at: h.at, title: humanize(h.action), detail: h.detail, actor: h.actorName }))}
          emptyText="No history yet."
        />
      </DrawerSection>

      {!terminal && isManager && <CancelTaskDialog task={task} open={cancelOpen} onClose={() => setCancelOpen(false)} />}
      {!terminal && canProgress && <CompleteTaskDialog task={task} open={completeOpen} onClose={() => setCompleteOpen(false)} />}
    </>
  );
}
