import { useEffect } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMaintenanceActions } from '@/hooks/useWorkflows';
import { useAssignableUsers } from '@/hooks/useAdmin';
import { ApiError } from '@/services/apiClient';
import type { MaintenanceDto, Priority } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { errorMessage } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { fromLocalInput, toLocalInput } from '@/utils/format';
import { PRIORITIES, priorityLabel } from '@/utils/labels';
import { FormError } from '@/components/workflow/DetailBits';

const schema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title must be at most 120 characters'),
  description: z.string().trim().max(2000, 'Description must be at most 2000 characters').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignedTechnicianId: z.string().optional(),
  dueDate: z
    .string()
    .min(1, 'Due date is required')
    .refine((v) => !!fromLocalInput(v), 'Enter a valid date and time')
    .refine((v) => new Date(v).getTime() > Date.now() - 60_000, 'Due date must be in the future'),
});
type Values = z.infer<typeof schema>;
const FIELDS: (keyof Values)[] = ['title', 'description', 'priority', 'assignedTechnicianId', 'dueDate'];

export interface MaintenanceCreateDialogProps {
  open: boolean;
  onClose: () => void;
  transformerId: string;
  /** Shown in the dialog description, e.g. "PP-TX-004 · Riverside 2". */
  transformerLabel?: string;
  /** Link the task to an alert (alerts page). */
  alertId?: string | null;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultPriority?: Priority;
  /** Days from now for the default due date (default 3). */
  defaultDueInDays?: number;
  onCreated?: (task: MaintenanceDto) => void;
}

function defaults(p: MaintenanceCreateDialogProps): Values {
  const due = new Date(Date.now() + (p.defaultDueInDays ?? 3) * 86_400_000);
  due.setSeconds(0, 0);
  return {
    title: p.defaultTitle ?? '',
    description: p.defaultDescription ?? '',
    priority: p.defaultPriority ?? 'MEDIUM',
    assignedTechnicianId: '',
    dueDate: toLocalInput(due.toISOString()),
  };
}

/**
 * Create a maintenance task for a transformer (optionally linked to an alert).
 * ADMIN/ENGINEER only — wrap the trigger in <RoleGate roles={['ADMIN','ENGINEER']}>.
 */
export function MaintenanceCreateDialog(props: MaintenanceCreateDialogProps) {
  const { open, onClose, transformerId, transformerLabel, alertId, onCreated } = props;
  const { create } = useMaintenanceActions();
  const technicians = useAssignableUsers('TECHNICIAN', open);
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(props) });

  // Fresh defaults each time the dialog opens.
  useEffect(() => {
    if (open) reset(defaults(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (v: Values) => {
    try {
      const task = await create.mutateAsync({
        transformerId,
        alertId: alertId ?? null,
        title: v.title.trim(),
        description: v.description?.trim() || null,
        priority: v.priority,
        assignedTechnicianId: v.assignedTechnicianId || null,
        dueDate: fromLocalInput(v.dueDate)!,
      });
      toast.success('Maintenance task created', `${task.title} · ${task.transformerCode}`);
      onCreated?.(task);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors.length) {
        let mapped = false;
        for (const fe of e.fieldErrors) {
          if ((FIELDS as string[]).includes(fe.field)) {
            setError(fe.field as FieldPath<Values>, { type: 'server', message: fe.message });
            mapped = true;
          }
        }
        if (mapped) return;
      }
      setError('root.server', { type: 'server', message: errorMessage(e, 'Could not create the task.') });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create maintenance task"
      description={transformerLabel ? `For ${transformerLabel}${alertId ? ' · linked to alert' : ''}` : undefined}
      dismissible={!isSubmitting}
    >
      <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-3" aria-label="Create maintenance task">
        <FormError message={errors.root?.server?.message} />
        <Field label="Title" required error={errors.title?.message}>
          <Input autoComplete="off" {...register('title')} />
        </Field>
        <Field label="Description" error={errors.description?.message}>
          <Textarea rows={3} {...register('description')} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Priority" required error={errors.priority?.message}>
            <Select {...register('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due" required error={errors.dueDate?.message}>
            <Input type="datetime-local" className="[color-scheme:light]" {...register('dueDate')} />
          </Field>
        </div>
        <Field
          label="Technician"
          error={errors.assignedTechnicianId?.message}
          hint={technicians.isError ? 'Could not load technicians — you can assign later.' : 'Optional. Assigning sets the task to Assigned.'}
        >
          <Select {...register('assignedTechnicianId')} disabled={technicians.isPending}>
            <option value="">{technicians.isPending ? 'Loading…' : 'Unassigned'}</option>
            {(technicians.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.region ? ` · ${u.region}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-fg-muted">
          <span aria-hidden="true" className="text-accent-ink">*</span> Required
        </p>
        <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Create task
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
