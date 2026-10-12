import { useEffect, useState, type FormEvent } from 'react';
import { useAllTransformers } from '@/hooks/useMonitoring';
import type { MaintenanceDto } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { MaintenanceCreateDialog } from './MaintenanceCreateDialog';

export interface NewMaintenanceTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (task: MaintenanceDto) => void;
}

/**
 * "New task" flow for the maintenance page: pick a transformer, then the standard
 * MaintenanceCreateDialog (which needs a transformerId). ADMIN/ENGINEER only.
 */
export function NewMaintenanceTaskDialog({ open, onClose, onCreated }: NewMaintenanceTaskDialogProps) {
  const transformers = useAllTransformers();
  const [transformerId, setTransformerId] = useState('');
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setStep('pick');
      setTransformerId('');
      setError(undefined);
    }
  }, [open]);

  const options = [...(transformers.data ?? [])].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const selected = options.find((t) => t.id === transformerId);

  const next = (e: FormEvent) => {
    e.preventDefault();
    if (!transformerId) {
      setError('Choose a transformer');
      return;
    }
    setStep('form');
  };

  return (
    <>
      <Dialog open={open && step === 'pick'} onClose={onClose} size="sm" title="New maintenance task" description="Step 1 of 2 · choose the transformer.">
        <form noValidate onSubmit={next} className="flex flex-col gap-3" aria-label="Choose transformer">
          <Field
            label="Transformer"
            required
            error={error}
            hint={transformers.isError ? 'Could not load transformers. Close and try again.' : undefined}
          >
            <Select
              value={transformerId}
              disabled={transformers.isPending}
              onChange={(e) => {
                setTransformerId(e.target.value);
                setError(undefined);
              }}
            >
              <option value="">{transformers.isPending ? 'Loading…' : 'Select a transformer'}</option>
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.name} ({t.location})
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Continue
            </Button>
          </div>
        </form>
      </Dialog>
      {selected && (
        <MaintenanceCreateDialog
          open={open && step === 'form'}
          onClose={onClose}
          transformerId={selected.id}
          transformerLabel={`${selected.code} · ${selected.name}`}
          onCreated={onCreated}
        />
      )}
    </>
  );
}
