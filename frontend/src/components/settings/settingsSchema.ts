import { z } from 'zod';
import type { Role, SystemSettingsDto, SystemSettingsPatch } from '@/types/api';

export type ThresholdKey = keyof SystemSettingsDto['thresholds'];
export type WeightKey = keyof SystemSettingsDto['healthWeights'];

/** Threshold metrics with their direction (presentation + client validation mirroring the backend ordering rule). */
export const THRESHOLD_METRICS: { key: ThresholdKey; label: string; unit: string; direction: 'higher' | 'lower' }[] = [
  { key: 'temperatureC', label: 'Oil temperature', unit: '°C', direction: 'higher' },
  { key: 'oilLevelPct', label: 'Oil level', unit: '%', direction: 'lower' },
  { key: 'loadPct', label: 'Load', unit: '% of rating', direction: 'higher' },
  { key: 'voltageDeviationPct', label: 'Voltage deviation', unit: '% from nominal', direction: 'higher' },
  { key: 'currentPctOfRated', label: 'Current', unit: '% of rated', direction: 'higher' },
];

export const WEIGHT_FIELDS: { key: WeightKey; label: string }[] = [
  { key: 'temperature', label: 'Temperature' },
  { key: 'oilLevel', label: 'Oil level' },
  { key: 'load', label: 'Load' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'faultHistory', label: 'Fault history' },
];

export const NOTIFICATION_ROLE_FIELDS = [
  { key: 'criticalAlertRoles', label: 'New critical alert' },
  { key: 'offlineRoles', label: 'Transformer offline' },
  { key: 'resolvedRoles', label: 'Incident resolved' },
] as const;

/** Synthetic error key for the weights-sum rule. */
export const WEIGHTS_TOTAL = 'weightsTotal';

const num = (msg = 'Enter a number') => z.number({ invalid_type_error: msg, required_error: msg });
const int = () => num().int('Must be a whole number');
const band = z.object({ good: num(), warn: num(), critical: num() });
const roles = z.array(z.enum(['ADMIN', 'ENGINEER', 'OPERATOR', 'TECHNICIAN']));

export const settingsSchema = z
  .object({
    thresholds: z.object({
      temperatureC: band,
      oilLevelPct: band,
      loadPct: band,
      voltageDeviationPct: band,
      currentPctOfRated: band,
    }),
    sensorTimeoutSeconds: int().min(10, 'At least 10 seconds').max(86_400, 'At most 86,400 seconds'),
    recoveryReadings: int().min(1, 'At least 1 reading').max(100, 'At most 100 readings'),
    healthWeights: z.object({
      temperature: num().min(0, 'Cannot be negative').max(100, 'At most 100'),
      oilLevel: num().min(0, 'Cannot be negative').max(100, 'At most 100'),
      load: num().min(0, 'Cannot be negative').max(100, 'At most 100'),
      electrical: num().min(0, 'Cannot be negative').max(100, 'At most 100'),
      faultHistory: num().min(0, 'Cannot be negative').max(100, 'At most 100'),
    }),
    notifications: z.object({
      criticalAlertRoles: roles,
      offlineRoles: roles,
      resolvedRoles: roles,
      upcomingInspectionDays: int().min(1, 'At least 1 day').max(90, 'At most 90 days'),
    }),
    locations: z.array(z.object({ name: z.string().trim().min(1, 'Name is required').max(80, 'At most 80 characters') })),
    simulation: z.object({
      enabled: z.boolean(),
      intervalSeconds: int().min(1, 'At least 1 second').max(3600, 'At most 3,600 seconds'),
      noiseFactor: num().min(0, 'Cannot be negative').max(10, 'At most 10'),
    }),
  })
  .superRefine((v, ctx) => {
    for (const m of THRESHOLD_METRICS) {
      const b = v.thresholds[m.key];
      if ([b.good, b.warn, b.critical].some((x) => Number.isNaN(x))) continue;
      if (m.direction === 'higher') {
        if (!(b.warn > b.good)) ctx.addIssue({ code: 'custom', path: ['thresholds', m.key, 'warn'], message: 'Warn must be above good' });
        if (!(b.critical > b.warn)) ctx.addIssue({ code: 'custom', path: ['thresholds', m.key, 'critical'], message: 'Critical must be above warn' });
      } else {
        if (!(b.warn < b.good)) ctx.addIssue({ code: 'custom', path: ['thresholds', m.key, 'warn'], message: 'Warn must be below good' });
        if (!(b.critical < b.warn)) ctx.addIssue({ code: 'custom', path: ['thresholds', m.key, 'critical'], message: 'Critical must be below warn' });
      }
    }
    const total = weightsTotal(v.healthWeights);
    if (Math.abs(total - 100) > 0.001) {
      ctx.addIssue({ code: 'custom', path: [WEIGHTS_TOTAL], message: `Health weights must add up to 100 (currently ${formatTotal(total)})` });
    }
    const seen = new Set<string>();
    v.locations.forEach((l, i) => {
      const k = l.name.trim().toLowerCase();
      if (k && seen.has(k)) ctx.addIssue({ code: 'custom', path: ['locations', i, 'name'], message: 'Duplicate location' });
      seen.add(k);
    });
  });

export type SettingsFormValues = z.infer<typeof settingsSchema>;

export function weightsTotal(w: Partial<Record<WeightKey, number>> | undefined): number {
  if (!w) return 0;
  return Object.values(w).reduce<number>((s, x) => s + (typeof x === 'number' && Number.isFinite(x) ? x : 0), 0);
}

export function formatTotal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function toFormValues(s: SystemSettingsDto): SettingsFormValues {
  return {
    thresholds: structuredCloneSafe(s.thresholds),
    sensorTimeoutSeconds: s.sensorTimeoutSeconds,
    recoveryReadings: s.recoveryReadings,
    healthWeights: { ...s.healthWeights },
    notifications: {
      criticalAlertRoles: [...s.notifications.criticalAlertRoles],
      offlineRoles: [...s.notifications.offlineRoles],
      resolvedRoles: [...s.notifications.resolvedRoles],
      upcomingInspectionDays: s.notifications.upcomingInspectionDays,
    },
    locations: s.locations.map((name) => ({ name })),
    simulation: { ...s.simulation },
  };
}

export function toPatch(v: SettingsFormValues): SystemSettingsPatch {
  return {
    thresholds: v.thresholds,
    sensorTimeoutSeconds: v.sensorTimeoutSeconds,
    recoveryReadings: v.recoveryReadings,
    healthWeights: v.healthWeights,
    notifications: {
      ...v.notifications,
      criticalAlertRoles: v.notifications.criticalAlertRoles as Role[],
      offlineRoles: v.notifications.offlineRoles as Role[],
      resolvedRoles: v.notifications.resolvedRoles as Role[],
    },
    locations: v.locations.map((l) => l.name.trim()),
    simulation: v.simulation,
  };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Map a server field path (e.g. "thresholds.temperatureC.warn", "locations[2]", "healthWeights")
 * to a form path, or null when it has no input.
 */
export function formPathForServerField(field: string): string | null {
  const path = field.replace(/\[(\d+)\]/g, '.$1');
  if (/^healthWeights$/.test(path)) return WEIGHTS_TOTAL;
  if (/^locations\.\d+$/.test(path)) return `${path}.name`;
  if (/^thresholds\.\w+\.(good|warn|critical)$/.test(path)) return path;
  if (/^healthWeights\.\w+$/.test(path)) return path;
  if (/^notifications\.\w+$/.test(path)) return path;
  if (/^simulation\.(intervalSeconds|noiseFactor|enabled)$/.test(path)) return path;
  if (path === 'sensorTimeoutSeconds' || path === 'recoveryReadings' || path === 'locations') return path;
  return null;
}
