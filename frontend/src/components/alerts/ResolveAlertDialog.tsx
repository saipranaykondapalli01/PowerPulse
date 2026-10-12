import { useEffect, useState } from 'react';
import { ApiError } from '@/services/apiClient';
import { useAlertActions } from '@/hooks/useWorkflows';
import type { AlertDto } from '@/types/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { errorMessage } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { faultTypeLabel } from '@/utils/labels';

export interface ResolveAlertDialogProps {
  alert: AlertDto;
  open: boolean;
  onClose: () => void;
}

const MIN_NOTES = 'Resolution notes must be at least 5 characters';

/** Resolve an alert with required notes (ADMIN/ENGINEER). Closes only after the backend confirms. */
export function ResolveAlertDialog({ alert, open, onClose }: ResolveAlertDialogProps) {
  const { resolve } = useAlertActions();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();

  useEffect(() => {
    if (open) {
      setError(undefined);
      setFieldError(undefined);
    }
  }, [open]);

  const confirm = async (notes: string) => {
    setError(undefined);
    setFieldError(undefined);
    try {
      await resolve.mutateAsync({ id: alert.id, notes });
      toast.success('Alert resolved', `${faultTypeLabel[alert.faultType]} on ${alert.transformerCode}`);
      onClose();
    } catch (e) {
      const fe = e instanceof ApiError ? e.fieldErrors.find((f) => f.field === 'resolutionNotes') : undefined;
      if (fe) setFieldError(fe.message);
      else setError(errorMessage(e, 'Could not resolve the alert.'));
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      title="Resolve alert"
      description={`${faultTypeLabel[alert.faultType]} on ${alert.transformerCode}. Notes are stored with the incident record.`}
      confirmLabel="Resolve alert"
      error={error}
      reasonError={fieldError}
      reason={{
        label: 'Resolution notes',
        required: true,
        minLength: 5,
        maxLength: 2000,
        rows: 4,
        requiredMessage: MIN_NOTES,
        hint: 'What was found and done (min 5 characters).',
      }}
    />
  );
}
