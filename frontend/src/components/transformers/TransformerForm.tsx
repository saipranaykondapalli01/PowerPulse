import { useId } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertOctagon } from 'lucide-react';
import { ApiError } from '@/services/apiClient';
import type { TransformerDto, TransformerUpsertRequest } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { errorMessage } from '@/components/ui/ErrorState';

const num = (label: string) =>
  z.number({ required_error: `${label} is required`, invalid_type_error: `${label} is required` }).finite();

/** Mirrors backend Bean Validation on TransformerUpsertRequest. */
export const transformerSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{3,20}$/, 'Use 3–20 characters: uppercase letters, digits and hyphens (e.g. PP-TX-021)'),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  location: z.string().trim().min(1, 'Location is required').max(80, 'Location must be at most 80 characters'),
  latitude: num('Latitude').min(-90, 'Latitude must be between −90 and 90').max(90, 'Latitude must be between −90 and 90'),
  longitude: num('Longitude')
    .min(-180, 'Longitude must be between −180 and 180')
    .max(180, 'Longitude must be between −180 and 180'),
  gridX: num('Grid X'),
  gridZ: num('Grid Z'),
  ratedCapacityKva: num('Rated capacity').positive('Rated capacity must be greater than 0'),
  primaryVoltageKv: num('Primary voltage').positive('Primary voltage must be greater than 0'),
  secondaryVoltageV: num('Secondary voltage').positive('Secondary voltage must be greater than 0'),
});

export type TransformerFormValues = z.infer<typeof transformerSchema>;
const FIELDS = Object.keys(transformerSchema.shape) as (keyof TransformerFormValues)[];

export interface TransformerFormProps {
  mode: 'create' | 'edit';
  /** Existing transformer for edit mode. */
  initial?: Pick<TransformerDto, keyof TransformerFormValues>;
  /** Known locations offered as suggestions (free text is allowed). */
  locations?: string[];
  /** Perform the API call. Throw ApiError to have fieldErrors / 409 mapped onto inputs. */
  onSubmit: (body: TransformerUpsertRequest) => Promise<unknown>;
  onCancel?: () => void;
  /** Called after a successful submit. */
  onSuccess?: () => void;
}

/** Register / edit transformer form (RHF + Zod). Maps server fieldErrors and duplicate-code 409 onto inputs. */
export function TransformerForm({ mode, initial, locations = [], onSubmit, onCancel, onSuccess }: TransformerFormProps) {
  const listId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TransformerFormValues>({
    resolver: zodResolver(transformerSchema),
    defaultValues: initial
      ? {
          code: initial.code,
          name: initial.name,
          location: initial.location,
          latitude: initial.latitude,
          longitude: initial.longitude,
          gridX: initial.gridX,
          gridZ: initial.gridZ,
          ratedCapacityKva: initial.ratedCapacityKva,
          primaryVoltageKv: initial.primaryVoltageKv,
          secondaryVoltageV: initial.secondaryVoltageV,
        }
      : { code: '', name: '', location: '' },
  });

  const submit = async (values: TransformerFormValues) => {
    try {
      await onSubmit(values);
      onSuccess?.();
    } catch (e) {
      if (e instanceof ApiError) {
        let mapped = false;
        for (const fe of e.fieldErrors) {
          if ((FIELDS as string[]).includes(fe.field)) {
            setError(fe.field as FieldPath<TransformerFormValues>, { type: 'server', message: fe.message });
            mapped = true;
          }
        }
        if (e.status === 409 && !mapped) {
          setError('code', { type: 'server', message: e.message || 'A transformer with this code already exists.' });
          mapped = true;
        }
        if (mapped) return;
      }
      setError('root.server', { type: 'server', message: errorMessage(e, 'Could not save the transformer.') });
    }
  };

  const numberProps = (name: keyof TransformerFormValues) =>
    register(name, { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)) });

  const serverError = errors.root?.server?.message;

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" aria-label={mode === 'create' ? 'Register transformer' : 'Edit transformer'}>
      {serverError && (
        <div role="alert" className="flex items-start gap-2 rounded-sm border border-critical/50 bg-critical/10 px-3 py-2 text-sm text-critical">
          <AlertOctagon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Code" required error={errors.code?.message} hint="Uppercase letters, digits, hyphens">
          <Input
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
            {...register('code', { setValueAs: (v: string) => (typeof v === 'string' ? v.trim().toUpperCase() : v) })}
          />
        </Field>
        <Field label="Name" required error={errors.name?.message}>
          <Input autoComplete="off" {...register('name')} />
        </Field>
        <Field label="Location" required error={errors.location?.message} hint="Pick an existing location or type a new one" className="sm:col-span-2">
          <Input list={`${listId}-locations`} autoComplete="off" {...register('location')} />
        </Field>
        <datalist id={`${listId}-locations`}>
          {locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <fieldset className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <legend className="mb-2 font-mono text-label uppercase text-fg-muted">Position</legend>
        <Field label="Latitude" required error={errors.latitude?.message}>
          <Input type="number" step="any" inputMode="decimal" {...numberProps('latitude')} />
        </Field>
        <Field label="Longitude" required error={errors.longitude?.message}>
          <Input type="number" step="any" inputMode="decimal" {...numberProps('longitude')} />
        </Field>
        <Field label="Grid X" required error={errors.gridX?.message} hint="3D scene units">
          <Input type="number" step="any" inputMode="decimal" {...numberProps('gridX')} />
        </Field>
        <Field label="Grid Z" required error={errors.gridZ?.message} hint="3D scene units">
          <Input type="number" step="any" inputMode="decimal" {...numberProps('gridZ')} />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-3">
        <legend className="mb-2 font-mono text-label uppercase text-fg-muted">Rating</legend>
        <Field label="Rated capacity" required error={errors.ratedCapacityKva?.message}>
          <Input type="number" step="any" min={0} inputMode="decimal" trailing="kVA" {...numberProps('ratedCapacityKva')} />
        </Field>
        <Field label="Primary voltage" required error={errors.primaryVoltageKv?.message}>
          <Input type="number" step="any" min={0} inputMode="decimal" trailing="kV" {...numberProps('primaryVoltageKv')} />
        </Field>
        <Field label="Secondary voltage" required error={errors.secondaryVoltageV?.message}>
          <Input type="number" step="any" min={0} inputMode="decimal" trailing="V" {...numberProps('secondaryVoltageV')} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {mode === 'create' ? 'Register transformer' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
