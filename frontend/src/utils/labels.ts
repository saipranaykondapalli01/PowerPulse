/** Human-readable labels for API enums. Presentation only. */
import type {
  AlertStatus,
  FaultType,
  MaintenanceStatus,
  NotificationType,
  Priority,
  ReadingSource,
  Role,
  ScenarioName,
  Severity,
  TransformerStatus,
} from '@/types/api';

export const TRANSFORMER_STATUSES: TransformerStatus[] = ['HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE'];
export const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const ALERT_STATUSES: AlertStatus[] = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'];
export const MAINTENANCE_STATUSES: MaintenanceStatus[] = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const FAULT_TYPES: FaultType[] = [
  'OVERHEATING',
  'LOW_OIL_LEVEL',
  'OVERLOADING',
  'ABNORMAL_VOLTAGE',
  'ABNORMAL_CURRENT',
  'SENSOR_FAILURE',
  'STALE_READING',
];
export const ROLES: Role[] = ['ADMIN', 'ENGINEER', 'OPERATOR', 'TECHNICIAN'];

export const statusLabel: Record<TransformerStatus, string> = {
  HEALTHY: 'Healthy',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
  OFFLINE: 'Offline',
};

export const severityLabel: Record<Severity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const alertStatusLabel: Record<AlertStatus, string> = {
  NEW: 'New',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

export const maintenanceStatusLabel: Record<MaintenanceStatus, string> = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const priorityLabel: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const faultTypeLabel: Record<FaultType, string> = {
  OVERHEATING: 'Overheating',
  LOW_OIL_LEVEL: 'Low oil level',
  OVERLOADING: 'Overloading',
  ABNORMAL_VOLTAGE: 'Abnormal voltage',
  ABNORMAL_CURRENT: 'Abnormal current',
  SENSOR_FAILURE: 'Sensor failure',
  STALE_READING: 'Stale reading',
};

/** Typical unit of the measured value per fault type. Alerts/incidents carry `unit`; prefer that when present. */
export const faultTypeUnit: Record<FaultType, string> = {
  OVERHEATING: '°C',
  LOW_OIL_LEVEL: '%',
  OVERLOADING: '%',
  ABNORMAL_VOLTAGE: '%',
  ABNORMAL_CURRENT: '%',
  SENSOR_FAILURE: '',
  STALE_READING: 's',
};

export const roleLabel: Record<Role, string> = {
  ADMIN: 'Admin',
  ENGINEER: 'Engineer',
  OPERATOR: 'Operator',
  TECHNICIAN: 'Technician',
};

export const notificationTypeLabel: Record<NotificationType, string> = {
  NEW_CRITICAL_ALERT: 'Critical alert',
  MAINTENANCE_ASSIGNED: 'Maintenance assigned',
  MAINTENANCE_OVERDUE: 'Maintenance overdue',
  UPCOMING_INSPECTION: 'Upcoming inspection',
  INCIDENT_RESOLVED: 'Incident resolved',
  TRANSFORMER_OFFLINE: 'Transformer offline',
};

export const readingSourceLabel: Record<ReadingSource, string> = {
  SIMULATED: 'Simulated',
  DEVICE: 'Device',
  MANUAL: 'Manual entry',
};

export const scenarioLabel: Record<ScenarioName, string> = {
  healthy: 'Healthy (nominal)',
  'rising-temperature': 'Rising temperature',
  'low-oil': 'Low oil',
  overloading: 'Overloading',
  'critical-overheating': 'Critical overheating',
  offline: 'Offline (stop readings)',
  'return-to-normal': 'Return to normal',
  manual: 'Manual readings (simulator skips)',
};

export const healthFactorLabel: Record<string, string> = {
  temperature: 'Temperature',
  oilLevel: 'Oil level',
  load: 'Load',
  electrical: 'Electrical',
  faultHistory: 'Fault history',
};

/** Fallback for any SCREAMING_CASE / kebab-case value: "LOW_OIL_LEVEL" → "Low oil level". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const s = value.replace(/[_-]+/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
