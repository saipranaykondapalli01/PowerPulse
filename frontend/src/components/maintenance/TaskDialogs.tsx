import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/services/apiClient';
import { useMaintenanceActions } from '@/hooks/useWorkflows';
import type { MaintenanceDto } from '@/types/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { errorMessage } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';

interface TaskDialogProps {
  task: MaintenanceDto;
  open: boolean;
  onClose: () => void;
}

/** Cancel a task with a required reason (ADMIN/ENGINEER). Irreversible, so it uses the danger confirm. */
export function CancelTaskDialog({ task, open, onClose }: TaskDialogProps) {
  const { update } = useMaintenanceActions();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();

  useEffect(() => {
    if (open) {
      setError(undefined);
      setFieldError(undefined);
    }
  }, [open]);

  const confirm = async (reason: string) => {
    setError(undefined);
    setFieldError(undefined);
    try {
      await update.mutateAsync({ id: task.id, body: { status: 'CANCELLED', cancelReason: reason } });
      toast.success('Task cancelled', task.title);
      onClose();
    } catch (e) {
      const fe = e instanceof ApiError ? e.fieldErrors.find((f) => f.field === 'cancelReason') : undefined;
      if (fe) setFieldError(fe.message);
      else setError(errorMessage(e, 'Could not cancel the task.'));
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      tone="danger"
      title="Cancel task"
      description={`${task.title} · ${task.transformerCode}. Cancelled tasks cannot be reopened.`}
      confirmLabel="Cancel task"
      cancelLabel="Keep task"
      error={error}
      reasonError={fieldError}
      reason={{
        label: 'Reason',
        required: true,
        minLength: 3,
        maxLength: 1000,
        requiredMessage: 'A cancellation reason is required',
        hint: 'Recorded in the task history.',
      }}
    />
  );
}

const completeSchema = z.object({
  inspectionFindings: z.string().trim().max(4000, 'Findings must be at most 4000 characters').optional(),
  workNote: z.string().trim().max(2000, 'Note must be at most 2000 characters').optional(),
});
type CompleteValues = z.infer<typeof completeSchema>;

/** Complete an IN_PROGRESS task with optional findings and a closing note. Input is kept if the request fails. */
export function CompleteTaskDialog({ task, open, onClose }: TaskDialogProps) {
  const { complete } = useMaintenanceActions();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CompleteValues>({ resolver: zodResolver(completeSchema) });

  useEffect(() => {
    if (open) reset({ inspectionFindings: task.inspectionFindings ?? '', workNote: '' });
  }, [open, reset, task.inspectionFindings]);

  const submit = async (v: CompleteValues) => {
    const body: { inspectionFindings?: string; workNote?: string } = {};
    const findings = v.inspectionFindings?.trim();
    if (findings && findings !== (task.inspectionFindings ?? '')) body.inspectionFindings = findings;
    if (v.workNote?.trim()) body.workNote = v.workNote.trim();
    try {
      await complete.mutateAsync({ id: task.id, body });
      toast.success('Task completed', task.title);
      onClose();
    } catch (e) {
      setError('root.server', { type: 'server', message: errorMessage(e, 'Could not complete the task.') });
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => handleSubmit(submit)()}
      size="md"
      title="Complete task"
      description={`${task.title} · ${task.transformerCode}. Completed tasks become read-only.`}
      confirmLabel="Mark complete"
      cancelLabel="Back"
      loading={isSubmitting}
      error={errors.root?.server?.message}
    >
      <Field label="Inspection findings" error={errors.inspectionFindings?.message} hint="Optional.">
        <Textarea rows={4} {...register('inspectionFindings')} />
      </Field>
      <Field label="Closing note" error={errors.workNote?.message} hint="Optional. Added to the work notes.">
        <Textarea rows={3} {...register('workNote')} />
      </Field>
    </ConfirmDialog>
  );
}
