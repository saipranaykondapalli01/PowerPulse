/**
 * PowerPulse API contract: TypeScript mirror of the backend DTOs.
 * This file is AUTHORITATIVE for request/response shapes. Java DTO records mirror it field-for-field.
 * See docs/api-contracts.md for endpoints and docs/data-models.md for persistence.
 */

// ---------- Enums ----------
export type Role = 'ADMIN' | 'ENGINEER' | 'OPERATOR' | 'TECHNICIAN';
export type TransformerStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
export type FaultType =
  | 'OVERHEATING'
  | 'LOW_OIL_LEVEL'
  | 'OVERLOADING'
  | 'ABNORMAL_VOLTAGE'
  | 'ABNORMAL_CURRENT'
  | 'SENSOR_FAILURE'
  | 'STALE_READING';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED';
export type MaintenanceStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type NotificationType =
  | 'NEW_CRITICAL_ALERT'
  | 'MAINTENANCE_ASSIGNED'
  | 'MAINTENANCE_OVERDUE'
  | 'UPCOMING_INSPECTION'
  | 'INCIDENT_RESOLVED'
  | 'TRANSFORMER_OFFLINE';
/** MANUAL = entered by a signed-in user (ADMIN, ENGINEER, TECHNICIAN). */
export type ReadingSource = 'SIMULATED' | 'DEVICE' | 'MANUAL';
export type ResourceType = 'TRANSFORMER' | 'ALERT' | 'MAINTENANCE' | 'INCIDENT' | 'USER' | 'SETTINGS' | 'SIMULATION';
export type ScenarioName =
  | 'healthy'
  | 'rising-temperature'
  | 'low-oil'
  | 'overloading'
  | 'critical-overheating'
  | 'offline'
  | 'return-to-normal'
  /** Simulator skips this transformer because its readings are entered manually. */
  | 'manual';

/** ISO-8601 UTC timestamp string. */
export type Instant = string;

// ---------- Common ----------
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  timestamp: Instant;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  fieldErrors: ApiFieldError[];
}

export interface PageParams {
  page?: number;
  size?: number;
  /** e.g. "healthScore,asc" */
  sort?: string;
}

// ---------- Auth & users ----------
export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  region: string | null;
  active: boolean;
  createdAt: Instant | null;
  updatedAt: Instant | null;
}

export interface UserSummary {
  id: string;
  name: string;
  role: Role;
  region: string | null;
}

export interface UserCreateRequest {
  name: string;
  email: string;
  /** min 10 chars, must contain a letter and a digit */
  password: string;
  role: Role;
  region?: string | null;
}

export interface UserUpdateRequest {
  name?: string;
  role?: Role;
  region?: string | null;
  active?: boolean;
  password?: string;
}

// ---------- Transformers & readings ----------
export interface ReadingSnapshot {
  temperatureC: number | null;
  oilLevelPct: number | null;
  voltageV: number | null;
  currentA: number | null;
  loadPct: number | null;
  powerFactor: number | null;
  recordedAt: Instant;
  source: ReadingSource;
}

export interface HealthFactor {
  /** temperature | oilLevel | load | electrical | faultHistory */
  factor: string;
  penalty: number;
  maxPenalty: number;
  detail: string;
}

export interface TransformerDto {
  id: string;
  code: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  gridX: number;
  gridZ: number;
  connectedTo: string[];
  ratedCapacityKva: number;
  primaryVoltageKv: number;
  secondaryVoltageV: number;
  healthScore: number;
  status: TransformerStatus;
  latestReading: ReadingSnapshot | null;
  lastReadingAt: Instant | null;
  /** seconds since lastReadingAt at response time; null if never reported */
  readingAgeSeconds: number | null;
  /** true when readingAgeSeconds > sensorTimeoutSeconds */
  stale: boolean;
  lastMaintenanceAt: Instant | null;
  activeFaultCount: number;
  /** highest severity among active alerts, null if none */
  highestActiveSeverity: Severity | null;
  createdAt: Instant | null;
  updatedAt: Instant | null;
}

export interface Recommendation {
  faultType: FaultType | null;
  title: string;
  action: string;
}

export interface TransformerDetailDto extends TransformerDto {
  healthFactors: HealthFactor[];
  recommendations: Recommendation[];
  /** I_rated = kVA*1000 / (sqrt(3) * secondaryVoltageV) */
  ratedCurrentA: number;
  sensorTimeoutSeconds: number;
}

export interface TransformerUpsertRequest {
  code?: string;
  name?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  gridX?: number;
  gridZ?: number;
  connectedTo?: string[];
  ratedCapacityKva?: number;
  primaryVoltageKv?: number;
  secondaryVoltageV?: number;
}

export interface TransformerListParams extends PageParams {
  q?: string;
  location?: string;
  status?: TransformerStatus;
  minCapacity?: number;
  maxCapacity?: number;
  minHealth?: number;
  maxHealth?: number;
}

export interface ReadingDto {
  id: string;
  transformerId: string;
  temperatureC: number | null;
  oilLevelPct: number | null;
  voltageV: number | null;
  currentA: number | null;
  loadPct: number | null;
  powerFactor: number | null;
  source: ReadingSource;
  simulationId: string | null;
  scenario: string | null;
  recordedAt: Instant;
}

/** Device ingestion body for POST /readings (X-Device-Key header). */
export interface ReadingInput {
  transformerId?: string;
  transformerCode?: string;
  temperatureC: number | null;
  oilLevelPct: number | null;
  voltageV: number | null;
  currentA: number | null;
  loadPct: number | null;
  powerFactor?: number | null;
  recordedAt?: Instant;
}

/** Body for POST /transformers/{id}/readings (roles: ADMIN, ENGINEER, TECHNICIAN). */
export interface ManualReadingRequest {
  temperatureC: number;
  oilLevelPct: number;
  voltageV: number;
  currentA: number;
  loadPct: number;
  powerFactor?: number | null;
  /** When the meter was read; defaults to now. Not in the future, not older than 7 days. */
  recordedAt?: Instant;
  /** Exclude the transformer from the simulator so the value is not overwritten (default true). */
  holdFromSimulator?: boolean;
  /** Short note recorded in the audit log (max 200 chars). */
  note?: string;
}

// ---------- Alerts ----------
export interface AlertEvent {
  at: Instant;
  /** CREATED | ESCALATED | ACKNOWLEDGED | ASSIGNED | STATUS_CHANGED | RECOVERED | RESOLVED | MAINTENANCE_LINKED */
  type: string;
  message: string;
  actor: string;
}

export interface AlertDto {
  id: string;
  transformerId: string;
  transformerCode: string;
  transformerName: string;
  location: string;
  faultType: FaultType;
  severity: Severity;
  peakSeverity: Severity;
  description: string;
  measuredValue: number | null;
  peakValue: number | null;
  threshold: number | null;
  unit: string;
  status: AlertStatus;
  active: boolean;
  incidentKey: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  acknowledgedAt: Instant | null;
  acknowledgedBy: string | null;
  resolvedAt: Instant | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  recovered: boolean;
  recoveredAt: Instant | null;
  recurrenceCount: number;
  events: AlertEvent[];
  maintenanceIds: string[];
  createdAt: Instant;
  updatedAt: Instant;
}

export interface AlertListParams extends PageParams {
  q?: string;
  status?: AlertStatus;
  severity?: Severity;
  faultType?: FaultType;
  transformerId?: string;
  location?: string;
  active?: boolean;
  from?: Instant;
  to?: Instant;
}

export interface AlertUpdateRequest {
  status?: Exclude<AlertStatus, 'RESOLVED'>;
}
export interface AlertAssignRequest {
  userId: string;
}
export interface AlertResolveRequest {
  resolutionNotes: string;
}

// ---------- Maintenance ----------
export interface WorkNote {
  at: Instant;
  authorId: string;
  authorName: string;
  text: string;
}
export interface PartReplaced {
  name: string;
  quantity: number;
  notes: string | null;
}
export interface TaskHistoryEntry {
  at: Instant;
  actorName: string;
  action: string;
  detail: string | null;
}

export interface MaintenanceDto {
  id: string;
  transformerId: string;
  transformerCode: string;
  transformerName: string;
  location: string;
  alertId: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  status: MaintenanceStatus;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  dueDate: Instant;
  overdue: boolean;
  inspectionFindings: string | null;
  workNotes: WorkNote[];
  partsReplaced: PartReplaced[];
  completedAt: Instant | null;
  cancelledAt: Instant | null;
  cancelReason: string | null;
  createdById: string;
  createdByName: string;
  history: TaskHistoryEntry[];
  createdAt: Instant;
  updatedAt: Instant;
}

export interface MaintenanceListParams extends PageParams {
  q?: string;
  status?: MaintenanceStatus;
  priority?: Priority;
  technicianId?: string;
  transformerId?: string;
  overdue?: boolean;
  /** due within SystemSettings.notifications.upcomingInspectionDays */
  upcoming?: boolean;
}

export interface MaintenanceCreateRequest {
  transformerId: string;
  alertId?: string | null;
  title: string;
  description?: string | null;
  priority: Priority;
  assignedTechnicianId?: string | null;
  dueDate: Instant;
}

export interface MaintenanceUpdateRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  dueDate?: Instant;
  assignedTechnicianId?: string;
  /** ASSIGNED->IN_PROGRESS, or CANCELLED (requires cancelReason). COMPLETED only via /complete. */
  status?: Exclude<MaintenanceStatus, 'COMPLETED'>;
  inspectionFindings?: string;
  addWorkNote?: string;
  addPart?: { name: string; quantity: number; notes?: string | null };
  cancelReason?: string;
}

export interface MaintenanceCompleteRequest {
  inspectionFindings?: string;
  workNote?: string;
}

// ---------- Fault history ----------
export interface FaultIncidentDto {
  id: string;
  alertId: string;
  transformerId: string;
  transformerCode: string;
  location: string;
  faultType: FaultType;
  severity: Severity;
  startedAt: Instant;
  resolvedAt: Instant | null;
  durationSeconds: number | null;
  peakValue: number | null;
  threshold: number | null;
  unit: string;
  readings: ReadingSnapshot[];
  actionsTaken: string[];
  recurrenceCount: number;
  maintenanceIds: string[];
  resolutionNotes: string | null;
}

export interface FaultHistoryParams extends PageParams {
  transformerId?: string;
  location?: string;
  faultType?: FaultType;
  severity?: Severity;
  from?: Instant;
  to?: Instant;
}

// ---------- Notifications ----------
export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedType: ResourceType | null;
  relatedId: string | null;
  read: boolean;
  readAt: Instant | null;
  createdAt: Instant;
}

export interface NotificationListParams extends PageParams {
  read?: boolean;
  type?: NotificationType;
}

export interface UnreadCount {
  count: number;
}

// ---------- Dashboard ----------
export interface DashboardFilters {
  location?: string;
  status?: TransformerStatus;
  from?: Instant;
  to?: Instant;
}

export interface IncidentSummary {
  alertId: string;
  transformerId: string;
  transformerCode: string;
  faultType: FaultType;
  severity: Severity;
  status: AlertStatus;
  createdAt: Instant;
}

export interface MaintenanceSummary {
  id: string;
  transformerId: string;
  transformerCode: string;
  title: string;
  status: MaintenanceStatus;
  priority: Priority;
  dueDate: Instant;
  overdue: boolean;
  assignedTechnicianName: string | null;
  completedAt: Instant | null;
}

export interface DashboardSummary {
  totalTransformers: number;
  healthy: number;
  warning: number;
  critical: number;
  offline: number;
  /** capacity-weighted mean health of non-offline transformers; null when none online */
  networkHealth: number | null;
  /** sum over online transformers of loadPct/100 * ratedCapacityKva */
  totalLoadKva: number;
  totalCapacityKva: number;
  activeAlerts: number;
  activeCriticalAlerts: number;
  pendingMaintenance: number;
  overdueMaintenance: number;
  recentIncidents: IncidentSummary[];
  recentMaintenance: MaintenanceSummary[];
  generatedAt: Instant;
}

export interface TrendPoint {
  bucket: Instant;
  avgTemperatureC: number | null;
  maxTemperatureC: number | null;
  avgLoadPct: number | null;
  maxLoadPct: number | null;
  readings: number;
}

export interface HealthBucket {
  /** e.g. "80-100" */
  range: string;
  min: number;
  max: number;
  count: number;
}

export interface FaultFrequency {
  faultType: FaultType;
  count: number;
  critical: number;
}

// ---------- Reports ----------
export interface ReportFilters {
  from?: Instant;
  to?: Instant;
  location?: string;
}

export interface ReportSummary {
  from: Instant;
  to: Instant;
  transformers: number;
  averageHealth: number | null;
  incidents: number;
  resolvedIncidents: number;
  meanTimeToResolveSeconds: number | null;
  maintenanceCreated: number;
  maintenanceCompleted: number;
  highRiskTransformers: number;
}

export interface MaintenanceReport {
  byStatus: { status: MaintenanceStatus; count: number }[];
  byPriority: { priority: Priority; count: number }[];
  completedOnTime: number;
  completedLate: number;
  overdueOpen: number;
  averageCompletionHours: number | null;
  byTechnician: { technicianId: string; technicianName: string; assigned: number; completed: number }[];
}

export interface TransformerHealthReportRow {
  transformerId: string;
  code: string;
  name: string;
  location: string;
  healthScore: number;
  status: TransformerStatus;
  activeAlerts: number;
  incidentsInRange: number;
  highRisk: boolean;
  lastMaintenanceAt: Instant | null;
}

export interface IncidentDurationRow {
  faultType: FaultType;
  count: number;
  averageSeconds: number | null;
  maxSeconds: number | null;
}

export interface DowntimeRow {
  transformerId: string;
  code: string;
  location: string;
  offlineIncidents: number;
  totalOfflineSeconds: number;
}

export type CsvExportType = 'transformer-health' | 'fault-history' | 'maintenance' | 'readings';

// ---------- Admin ----------
export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: ResourceType;
  entityId: string | null;
  summary: string;
  at: Instant;
}

export interface AuditLogParams extends PageParams {
  actor?: string;
  entityType?: ResourceType;
  action?: string;
  from?: Instant;
  to?: Instant;
}

// ---------- Settings ----------
export interface ThresholdBand {
  good: number;
  warn: number;
  critical: number;
}

export interface SystemSettingsDto {
  thresholds: {
    temperatureC: ThresholdBand;
    oilLevelPct: ThresholdBand;
    loadPct: ThresholdBand;
    voltageDeviationPct: ThresholdBand;
    currentPctOfRated: ThresholdBand;
  };
  sensorTimeoutSeconds: number;
  recoveryReadings: number;
  healthWeights: {
    temperature: number;
    oilLevel: number;
    load: number;
    electrical: number;
    faultHistory: number;
  };
  notifications: {
    criticalAlertRoles: Role[];
    offlineRoles: Role[];
    resolvedRoles: Role[];
    upcomingInspectionDays: number;
  };
  locations: string[];
  simulation: { enabled: boolean; intervalSeconds: number; noiseFactor: number };
  updatedAt: Instant | null;
  updatedBy: string | null;
}

export type SystemSettingsPatch = Partial<Omit<SystemSettingsDto, 'updatedAt' | 'updatedBy'>>;

// ---------- Simulation ----------
export interface ActiveScenarioDto {
  transformerId: string;
  transformerCode: string;
  name: ScenarioName;
  startedAt: Instant;
  step: number;
}

export interface SimulationStatus {
  enabled: boolean;
  running: boolean;
  runId: string | null;
  tick: number;
  intervalSeconds: number;
  scenarios: ActiveScenarioDto[];
  availableScenarios: ScenarioName[];
  lastTickAt: Instant | null;
}

// ---------- Public ----------
export interface NetworkPreviewNode {
  id: string;
  code: string;
  name: string;
  location: string;
  gridX: number;
  gridZ: number;
  connectedTo: string[];
  status: TransformerStatus;
  healthScore: number;
  loadPct: number | null;
  temperatureC: number | null;
  oilLevelPct: number | null;
  voltageV: number | null;
  currentA: number | null;
  ratedCapacityKva: number;
  activeFaultCount: number;
  simulated: true;
}
