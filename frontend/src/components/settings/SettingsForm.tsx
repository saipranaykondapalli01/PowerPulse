import { useState } from 'react';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Lock, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useUpdateSettings } from '@/hooks/useAdmin';
import { ApiError } from '@/services/apiClient';
import type { SystemSettingsDto } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { FormError } from '@/components/workflow/DetailBits';
import { formatDateTime } from '@/utils/format';
import { ROLES, roleLabel } from '@/utils/labels';
import {
  formatTotal,
  formPathForServerField,
  NOTIFICATION_ROLE_FIELDS,
  settingsSchema,
  THRESHOLD_METRICS,
  toFormValues,
  toPatch,
  WEIGHT_FIELDS,
  WEIGHTS_TOTAL,
  weightsTotal,
  type SettingsFormValues,
} from './settingsSchema';
import { SettingsIndex, SettingsSection } from './SettingsSection';

export interface SettingsFormProps {
  settings: SystemSettingsDto;
  /** Only ADMIN may edit; everyone else sees a read-only form. */
  editable: boolean;
}

export function SettingsForm({ settings, editable }: SettingsFormProps) {
  const update = useUpdateSettings();
  const toast = useToast();
  const [newLocation, setNewLocation] = useState('');
  const [newLocationError, setNewLocationError] = useState<string>();
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema), defaultValues: toFormValues(settings) });
  const locations = useFieldArray({ control, name: 'locations' });

  const weights = watch('healthWeights');
  const total = weightsTotal(weights);
  const totalOk = Math.abs(total - 100) <= 0.001;
  const totalError = (errors as Record<string, { message?: string } | undefined>)[WEIGHTS_TOTAL]?.message;

  const submit = async (v: SettingsFormValues) => {
    try {
      const saved = await update.mutateAsync(toPatch(v));
      reset(toFormValues(saved));
      toast.success('Settings saved');
    } catch (e) {
      let unmapped: string[] = [];
      if (e instanceof ApiError && e.fieldErrors.length) {
        for (const fe of e.fieldErrors) {
          const path = formPathForServerField(fe.field);
          if (path) setError(path as FieldPath<SettingsFormValues>, { type: 'server', message: fe.message });
          else unmapped.push(`${fe.field}: ${fe.message}`);
        }
      } else {
        unmapped = [errorMessage(e, 'Could not save settings.')];
      }
      if (unmapped.length) setError('root.server', { type: 'server', message: unmapped.join(' · ') });
      toast.error('Settings not saved', e instanceof ApiError ? e.message : undefined);
    }
  };

  const addLocation = () => {
    const name = newLocation.trim();
    if (!name) return setNewLocationError('Enter a location name');
    if (locations.fields.some((_, i) => watch(`locations.${i}.name`).trim().toLowerCase() === name.toLowerCase())) {
      return setNewLocationError('That location already exists');
    }
    locations.append({ name });
    setNewLocation('');
    setNewLocationError(undefined);
  };

  const numberOpts = { valueAsNumber: true } as const;

  return (
    <form noValidate onSubmit={handleSubmit(submit)} aria-label="System settings" className="flex flex-col gap-5">
      {!editable && (
        <div role="note" className="flex items-start gap-2 rounded-sm border border-line bg-raised/60 px-3 py-2.5 text-sm text-fg-muted">
          <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-fg" />
          <span>
            <span className="font-medium text-fg">Read-only.</span> Only administrators can change system settings. Values are
            shown for reference.
          </span>
        </div>
      )}
      <FormError message={errors.root?.server?.message} />

      <SettingsIndex className="border-t border-line pt-3" />

      <fieldset disabled={!editable || isSubmitting} className="flex min-w-0 flex-col gap-8">
        <legend className="sr-only">System settings</legend>

        <SettingsSection
          id="thresholds"
          index="01"
          flush
          title="Monitoring thresholds"
          description="Good, warn and critical bands that turn readings into alerts and health penalties."
          notes={
            <>
              <p className="rounded-sm border border-warning/30 bg-warning-bg px-2 py-1.5 text-warning">
                Configurable demo defaults — not universal electrical safety limits.
              </p>
              <p className="flex items-center gap-1.5">
                <ArrowUp aria-hidden="true" className="h-3 w-3" /> Higher is worse: good &lt; warn &lt; critical
              </p>
              <p className="flex items-center gap-1.5">
                <ArrowDown aria-hidden="true" className="h-3 w-3" /> Lower is worse: good &gt; warn &gt; critical
              </p>
            </>
          }
        >
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Good, warn and critical threshold per metric</caption>
              <thead>
                <tr className="text-left font-mono text-label uppercase text-fg-muted">
                  <th scope="col" className="px-4 py-2.5 font-normal">Metric</th>
                  <th scope="col" className="py-2.5 pr-3 font-normal"><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-healthy" />Good</span></th>
                  <th scope="col" className="py-2.5 pr-3 font-normal"><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-warning" />Warn</span></th>
                  <th scope="col" className="py-2.5 pr-4 font-normal"><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-critical" />Critical</span></th>
                </tr>
              </thead>
              <tbody>
                {THRESHOLD_METRICS.map((m) => (
                  <tr key={m.key} className="border-t border-line/70 align-top">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <span className="block text-fg">{m.label}</span>
                      <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-fg-muted">
                        {m.direction === 'higher' ? <ArrowUp aria-hidden="true" className="h-3 w-3" /> : <ArrowDown aria-hidden="true" className="h-3 w-3" />}
                        {m.unit} · {m.direction === 'higher' ? 'higher is worse' : 'lower is worse'}
                      </span>
                    </th>
                    {(['good', 'warn', 'critical'] as const).map((lvl) => (
                      <td key={lvl} className="py-2.5 pr-3 last:pr-4">
                        <Field label={`${m.label} ${lvl}`} hideLabel error={errors.thresholds?.[m.key]?.[lvl]?.message}>
                          <Input type="number" step="any" inputMode="decimal" className="tabular font-mono" {...register(`thresholds.${m.key}.${lvl}`, numberOpts)} />
                        </Field>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsSection>

        <SettingsSection
          id="sensor"
          index="02"
          title="Sensor & recovery"
          description="How long a transformer may stay silent before it is offline, and how many normal readings clear an alert."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Sensor timeout" error={errors.sensorTimeoutSeconds?.message} hint="Seconds without a reading before a transformer is offline. 10–86,400.">
              <Input type="number" min={10} step={1} inputMode="numeric" trailing="s" {...register('sensorTimeoutSeconds', numberOpts)} />
            </Field>
            <Field label="Recovery readings" error={errors.recoveryReadings?.message} hint="Consecutive normal readings before an alert recovers. 1–100.">
              <Input type="number" min={1} step={1} inputMode="numeric" {...register('recoveryReadings', numberOpts)} />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          id="weights"
          index="03"
          title="Health score weights"
          description="Maximum penalty per factor when computing the 0–100 health score. The five weights must add up to 100."
          status={
            <span
              aria-live="polite"
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-xs',
                totalOk ? 'border-healthy/30 bg-healthy-bg text-healthy' : 'border-critical/35 bg-critical-bg text-critical',
              )}
            >
              Total {formatTotal(total)} / 100{totalOk ? ' ✓' : ' ✗'}
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {WEIGHT_FIELDS.map((w) => (
              <Field key={w.key} label={w.label} error={errors.healthWeights?.[w.key]?.message}>
                <Input type="number" min={0} max={100} step="any" inputMode="decimal" className="tabular font-mono" {...register(`healthWeights.${w.key}`, numberOpts)} />
              </Field>
            ))}
          </div>
          <div aria-hidden="true" className="mt-4 flex h-1.5 w-full overflow-hidden rounded-sm bg-raised">
            {WEIGHT_FIELDS.map((w, i) => {
              const v = weights?.[w.key];
              const pct = typeof v === 'number' && Number.isFinite(v) && total > 0 ? (Math.max(0, v) / Math.max(total, 100)) * 100 : 0;
              return <span key={w.key} className={clsx('h-full', i % 2 ? 'bg-fg-muted' : 'bg-fg')} style={{ width: `${pct}%` }} />;
            })}
          </div>
          {totalError && (
            <p role="alert" className="mt-2 text-xs text-critical">
              {totalError}
            </p>
          )}
        </SettingsSection>

        <SettingsSection
          id="notifications"
          index="04"
          title="Notifications"
          description="Which roles receive each in-app notification, and how far ahead inspection reminders look."
        >
          <div className="flex flex-col gap-4">
            {NOTIFICATION_ROLE_FIELDS.map((n) => (
              <fieldset key={n.key} className="min-w-0 border-b border-line/70 pb-3">
                <legend className="mb-2 font-mono text-label uppercase text-fg-muted">{n.label}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" value={r} className="h-4 w-4 accent-[rgb(var(--ink))]" {...register(`notifications.${n.key}`)} />
                      {roleLabel[r]}
                    </label>
                  ))}
                </div>
                {errors.notifications?.[n.key]?.message && (
                  <p role="alert" className="mt-1 text-xs text-critical">
                    {errors.notifications[n.key]?.message}
                  </p>
                )}
              </fieldset>
            ))}
            <Field label="Upcoming inspection window" error={errors.notifications?.upcomingInspectionDays?.message} hint="Days ahead for upcoming-inspection reminders and the Upcoming tab. 1–90." className="sm:max-w-xs">
              <Input type="number" min={1} step={1} inputMode="numeric" trailing="days" {...register('notifications.upcomingInspectionDays', numberOpts)} />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          id="locations"
          index="05"
          title="Locations"
          description="Regions available when registering transformers and assigning users."
          notes={<p className="tabular font-mono">{locations.fields.length} configured</p>}
        >
          {locations.fields.length === 0 ? (
            <p className="mb-3 text-xs text-fg-muted">No locations configured.</p>
          ) : (
            <ul className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {locations.fields.map((f, i) => (
                <li key={f.id} className="flex items-start gap-2">
                  <Field label={`Location ${i + 1}`} hideLabel className="flex-1" error={errors.locations?.[i]?.name?.message}>
                    <Input {...register(`locations.${i}.name`)} />
                  </Field>
                  {editable && (
                    <IconButton label={`Remove location ${watch(`locations.${i}.name`) || i + 1}`} icon={<Trash2 />} onClick={() => locations.remove(i)} />
                  )}
                </li>
              ))}
            </ul>
          )}
          {errors.locations?.message && (
            <p role="alert" className="mb-2 text-xs text-critical">
              {errors.locations.message}
            </p>
          )}
          {editable && (
            <div className="flex items-end gap-2 border-t border-line pt-3 sm:max-w-md">
              <Field label="New location" className="flex-1" error={newLocationError}>
                <Input
                  value={newLocation}
                  onChange={(e) => {
                    setNewLocation(e.target.value);
                    setNewLocationError(undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLocation();
                    }
                  }}
                />
              </Field>
              <Button variant="secondary" icon={<Plus />} onClick={addLocation}>
                Add
              </Button>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          id="simulation"
          index="06"
          title="Simulation"
          description="Simulator behaviour for demo telemetry. Simulated readings are never real IoT data."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="col-span-full flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--ink))]" {...register('simulation.enabled')} />
              Simulator enabled
            </label>
            <Field label="Interval" error={errors.simulation?.intervalSeconds?.message} hint="Seconds between simulated readings. 1–3,600.">
              <Input type="number" min={1} step={1} inputMode="numeric" trailing="s" {...register('simulation.intervalSeconds', numberOpts)} />
            </Field>
            <Field label="Noise factor" error={errors.simulation?.noiseFactor?.message} hint="Multiplier for random variation (1 = default). 0–10.">
              <Input type="number" min={0} step="0.1" inputMode="decimal" {...register('simulation.noiseFactor', numberOpts)} />
            </Field>
          </div>
        </SettingsSection>
      </fieldset>

      <div
        className={clsx(
          'flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3',
          editable && 'sticky bottom-0 z-10 -mx-4 bg-canvas/95 px-4 pb-3 backdrop-blur sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8',
        )}
      >
        <p className="font-mono text-xs text-fg-muted">
          {editable && isDirty ? (
            <span className="text-warning">Unsaved changes · </span>
          ) : null}
          Last updated {formatDateTime(settings.updatedAt)}
          {settings.updatedBy ? ` by ${settings.updatedBy}` : ''}
        </p>
        {editable && (
          <div className="flex gap-2">
            <Button variant="ghost" icon={<RotateCcw />} disabled={!isDirty || isSubmitting} onClick={() => reset(toFormValues(settings))}>
              Discard changes
            </Button>
            <Button type="submit" variant="primary" icon={<Save />} loading={isSubmitting}>
              Save settings
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
