import { useEffect } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRecordReading } from '@/hooks/useMonitoring';
import { ApiError } from '@/services/apiClient';
import type { TransformerDetailDto } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { errorMessage } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { FormError } from '@/components/workflow/DetailBits';
import { formatNumber, fromLocalInput, toLocalInput } from '@/utils/format';

const MAX_BACKDATE_MS = 7 * 86_400_000;

/** A required number field (inputs are registered with valueAsNumber, so empty → NaN). */
const num = (label: string, min: number, max?: number) => {
  let s = z.number({ invalid_type_error: `${label} is required` }).min(min, `${label} must be at least ${min}`);
  if (max !== undefined) s = s.max(max, `${label} must be at most ${max}`);
  return s;
};

// Mirrors server-side validation in ManualReadingRequest / ManualReadingService.
export function buildSchema(secondaryVoltageV: number) {
  return z.object({
    temperatureC: num('Temperature', -40, 200),
    oilLevelPct: num('Oil level', 0, 100),
    voltageV: num('Voltage', 0, Math.round(secondaryVoltageV * 2)),
    currentA: num('Current', 0),
    loadPct: num('Load', 0, 300),
    powerFactor: z.preprocess(
      (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
      z.number().min(0, 'Power factor must be between 0 and 1').max(1, 'Power factor must be between 0 and 1').optional(),
    ),
    recordedAt: z
      .string()
      .min(1, 'Reading time is required')
      .refine((v) => !!fromLocalInput(v), 'Enter a valid date and time')
      .refine((v) => new Date(v).getTime() <= Date.now() + 120_000, 'Reading time cannot be in the future')
      .refine((v) => new Date(v).getTime() >= Date.now() - MAX_BACKDATE_MS, 'Reading time cannot be more than 7 days ago'),
    holdFromSimulator: z.boolean(),
    note: z.string().trim().max(200, 'Note must be at most 200 characters').optional(),
  });
}
type Values = z.infer<ReturnType<typeof buildSchema>>;
const FIELDS: (keyof Values)[] = [
  'temperatureC',
  'oilLevelPct',
  'voltageV',
  'currentA',
  'loadPct',
  'powerFactor',
  'recordedAt',
  'holdFromSimulator',
  'note',
];

export interface RecordReadingDialogProps {
  open: boolean;
  onClose: () => void;
  transformer: TransformerDetailDto;
}

function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  return toLocalInput(d.toISOString());
}

/**
 * Manual meter-reading entry (ADMIN, ENGINEER, TECHNICIAN — wrap the trigger in a RoleGate).
 * The reading runs through the same fault detection, health and alert pipeline as sensor data.
 */
export function RecordReadingDialog({ open, onClose, transformer: t }: RecordReadingDialogProps) {
  const record = useRecordReading(t.id);
  const toast = useToast();
  const last = t.latestReading;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(buildSchema(t.secondaryVoltageV)),
    defaultValues: { recordedAt: nowLocal(), holdFromSimulator: true, note: '' },
  });

  // Empty fields each time (placeholders show the last values) so an old reading is never resubmitted by accident.
  useEffect(() => {
    if (open) reset({ recordedAt: nowLocal(), holdFromSimulator: true, note: '' });
  }, [open, reset]);

  const submit = async (v: Values) => {
    try {
      await record.mutateAsync({
        temperatureC: v.temperatureC,
        oilLevelPct: v.oilLevelPct,
        voltageV: v.voltageV,
        currentA: v.currentA,
        loadPct: v.loadPct,
        powerFactor: v.powerFactor ?? null,
        recordedAt: fromLocalInput(v.recordedAt)!,
        holdFromSimulator: v.holdFromSimulator,
        note: v.note?.trim() || undefined,
      });
      toast.success('Reading recorded', `${t.code} — fault rules and health score re-evaluated`);
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
      setError('root.server', { type: 'server', message: errorMessage(e, 'Could not record the reading.') });
    }
  };

  const placeholder = (v: number | null | undefined, digits = 1) =>
    v == null ? undefined : `Last: ${formatNumber(v, digits)}`;
  const numberProps = { type: 'number', inputMode: 'decimal' as const, step: 'any' };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record meter reading"
      description={`${t.code} · ${t.name}. Entered values are checked against the same fault rules as sensor data.`}
      dismissible={!isSubmitting}
    >
      <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-3" aria-label="Record meter reading">
        <FormError message={errors.root?.server?.message} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Top-oil temperature (°C)" required error={errors.temperatureC?.message}>
            <Input {...numberProps} placeholder={placeholder(last?.temperatureC)} {...register('temperatureC', { valueAsNumber: true })} />
          </Field>
          <Field label="Oil level (%)" required error={errors.oilLevelPct?.message}>
            <Input {...numberProps} placeholder={placeholder(last?.oilLevelPct)} {...register('oilLevelPct', { valueAsNumber: true })} />
          </Field>
          <Field
            label="Voltage (V)"
            required
            hint={`Rated secondary ${formatNumber(t.secondaryVoltageV, 0)} V`}
            error={errors.voltageV?.message}
          >
            <Input {...numberProps} placeholder={placeholder(last?.voltageV)} {...register('voltageV', { valueAsNumber: true })} />
          </Field>
          <Field
            label="Current (A)"
            required
            hint={`Rated ${formatNumber(t.ratedCurrentA, 0)} A`}
            error={errors.currentA?.message}
          >
            <Input {...numberProps} placeholder={placeholder(last?.currentA)} {...register('currentA', { valueAsNumber: true })} />
          </Field>
          <Field label="Load (% of rated kVA)" required error={errors.loadPct?.message}>
            <Input {...numberProps} placeholder={placeholder(last?.loadPct)} {...register('loadPct', { valueAsNumber: true })} />
          </Field>
          <Field label="Power factor" hint="Optional, 0–1" error={errors.powerFactor?.message}>
            <Input {...numberProps} placeholder={placeholder(last?.powerFactor, 2)} {...register('powerFactor', { valueAsNumber: true })} />
          </Field>
        </div>
        <Field label="Reading time" required hint="When the meter was read (up to 7 days ago)" error={errors.recordedAt?.message}>
          <Input type="datetime-local" className="[color-scheme:light]" {...register('recordedAt')} />
        </Field>
        <Field label="Note" hint="Optional, saved in the audit log" error={errors.note?.message}>
          <Textarea rows={2} {...register('note')} />
        </Field>
        <label className="flex items-start gap-2.5 rounded-sm border border-line bg-canvas px-3 py-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--ink))]" {...register('holdFromSimulator')} />
          <span>
            <span className="font-medium text-fg">Hold this transformer from the simulator</span>
            <span className="mt-0.5 block text-xs text-fg-muted">
              Otherwise the next simulated reading (≈10 s) replaces this value. Held transformers go stale and show
              OFFLINE if no new reading is entered within the sensor timeout ({t.sensorTimeoutSeconds} s).
            </span>
          </span>
        </label>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Record reading
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
