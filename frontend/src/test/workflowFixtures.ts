/** Test-only fixtures for workflow/admin pages. Never imported by shipped code. */
import type { AlertDto, MaintenanceDto, NotificationDto, SystemSettingsDto } from '@/types/api';

export function makeAlert(over: Partial<AlertDto> = {}): AlertDto {
  const now = new Date().toISOString();
  return {
    id: 'a1',
    transformerId: 't4',
    transformerCode: 'PP-TX-004',
    transformerName: 'Harbour 4',
    location: 'Harbour',
    faultType: 'OVERHEATING',
    severity: 'CRITICAL',
    peakSeverity: 'CRITICAL',
    description: 'Oil temperature 108 °C exceeds critical threshold 105 °C',
    measuredValue: 108,
    peakValue: 110,
    threshold: 105,
    unit: '°C',
    status: 'NEW',
    active: true,
    incidentKey: 't4:OVERHEATING',
    assignedUserId: null,
    assignedUserName: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNotes: null,
    recovered: false,
    recoveredAt: null,
    recurrenceCount: 0,
    events: [{ at: now, type: 'CREATED', message: 'Alert raised', actor: 'system' }],
    maintenanceIds: [],
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

export function makeTask(over: Partial<MaintenanceDto> = {}): MaintenanceDto {
  const now = new Date().toISOString();
  return {
    id: 'm1',
    transformerId: 't4',
    transformerCode: 'PP-TX-004',
    transformerName: 'Harbour 4',
    location: 'Harbour',
    alertId: null,
    title: 'Inspect cooling fans',
    description: null,
    priority: 'HIGH',
    status: 'ASSIGNED',
    assignedTechnicianId: 'u-technician',
    assignedTechnicianName: 'Test TECHNICIAN',
    dueDate: new Date(Date.now() + 86_400_000).toISOString(),
    overdue: false,
    inspectionFindings: null,
    workNotes: [],
    partsReplaced: [],
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdById: 'u-engineer',
    createdByName: 'Test ENGINEER',
    history: [],
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

export function makeNotification(over: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'n1',
    title: 'Critical alert on PP-TX-004',
    message: 'Overheating 108 °C',
    type: 'NEW_CRITICAL_ALERT',
    relatedType: 'ALERT',
    relatedId: 'a1',
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

export function makeSettings(over: Partial<SystemSettingsDto> = {}): SystemSettingsDto {
  return {
    thresholds: {
      temperatureC: { good: 65, warn: 85, critical: 105 },
      oilLevelPct: { good: 80, warn: 60, critical: 40 },
      loadPct: { good: 70, warn: 90, critical: 110 },
      voltageDeviationPct: { good: 2, warn: 5, critical: 10 },
      currentPctOfRated: { good: 75, warn: 95, critical: 115 },
    },
    sensorTimeoutSeconds: 120,
    recoveryReadings: 3,
    healthWeights: { temperature: 30, oilLevel: 25, load: 20, electrical: 15, faultHistory: 10 },
    notifications: {
      criticalAlertRoles: ['ADMIN', 'ENGINEER', 'OPERATOR'],
      offlineRoles: ['ADMIN', 'ENGINEER', 'OPERATOR'],
      resolvedRoles: ['ADMIN', 'ENGINEER'],
      upcomingInspectionDays: 3,
    },
    locations: ['Riverside', 'Harbour'],
    simulation: { enabled: true, intervalSeconds: 10, noiseFactor: 1 },
    updatedAt: '2026-10-01T10:00:00Z',
    updatedBy: 'Admin',
    ...over,
  };
}
