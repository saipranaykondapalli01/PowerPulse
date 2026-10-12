# PowerPulse — Data Models (MongoDB)

These schemas are the **source of truth**. Java document classes live in `backend/src/main/java/com/powerpulse/<module>/` and the TypeScript DTO mirror is `frontend/src/types/api.ts`. Persisted documents are never returned directly: every API response goes through a DTO.

Timestamps are stored as `Instant` (UTC) and serialized as ISO-8601 strings. Ids are Mongo `ObjectId`s serialized as hex strings.

## Enums

| Enum | Values |
|---|---|
| `Role` | ADMIN, ENGINEER, OPERATOR, TECHNICIAN |
| `TransformerStatus` | HEALTHY, WARNING, CRITICAL, OFFLINE |
| `FaultType` | OVERHEATING, LOW_OIL_LEVEL, OVERLOADING, ABNORMAL_VOLTAGE, ABNORMAL_CURRENT, SENSOR_FAILURE, STALE_READING |
| `Severity` | LOW, MEDIUM, HIGH, CRITICAL (ordered; `ordinal()` is used for escalation) |
| `AlertStatus` | NEW, ACKNOWLEDGED, IN_PROGRESS, RESOLVED |
| `MaintenanceStatus` | PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED |
| `Priority` | LOW, MEDIUM, HIGH, URGENT |
| `NotificationType` | NEW_CRITICAL_ALERT, MAINTENANCE_ASSIGNED, MAINTENANCE_OVERDUE, UPCOMING_INSPECTION, INCIDENT_RESOLVED, TRANSFORMER_OFFLINE |
| `ReadingSource` | SIMULATED, DEVICE, MANUAL (entered by a signed-in user) |
| `ResourceType` | TRANSFORMER, ALERT, MAINTENANCE, INCIDENT, USER, SETTINGS, SIMULATION |

## Collections

### `users` — `user.User`
| Field | Type | Notes |
|---|---|---|
| id | String | |
| name | String | required |
| email | String | **unique index**, lower-cased |
| passwordHash | String | BCrypt; never serialized |
| role | Role | |
| region | String? | location the user is responsible for (null = all) |
| active | boolean | inactive users cannot log in |
| createdAt / updatedAt | Instant | `@CreatedDate` / `@LastModifiedDate` |

### `devices` — `security.Device` (sensor gateways)
| id | name | keyHash (SHA-256 hex of the device key, **unique**) | active | createdAt |

### `transformers` — `transformer.Transformer`
| Field | Type | Notes |
|---|---|---|
| id | String | |
| code | String | **unique index**, e.g. `PP-TX-001` |
| name | String | |
| location | String | indexed; also used as the "region" |
| latitude, longitude | double | geographic coordinates |
| gridX, gridZ | double | layout position in the 3D network (scene units) |
| connectedTo | List<String> | ids of downstream/peer transformers (network topology lines) |
| ratedCapacityKva | double | > 0 |
| primaryVoltageKv | double | e.g. 11 |
| secondaryVoltageV | double | e.g. 415 (line-to-line) |
| healthScore | int | 0–100, written only by `TransformerHealthService` |
| healthFactors | List<HealthFactor> | `{factor, penalty, maxPenalty, detail}` |
| status | TransformerStatus | indexed |
| latestReading | ReadingSnapshot? | embedded copy of the newest reading |
| lastReadingAt | Instant? | |
| lastMaintenanceAt | Instant? | set when a maintenance task completes |
| activeFaultCount | int | count of active alerts |
| createdAt / updatedAt | Instant | |
| version | Long | `@Version` optimistic locking |

`ReadingSnapshot` = `{temperatureC, oilLevelPct, voltageV, currentA, loadPct, powerFactor?, recordedAt, source}`.

### `sensor_readings` — `reading.SensorReading`
| Field | Type | Notes |
|---|---|---|
| id | String | |
| transformerId | String | |
| temperatureC | Double | top-oil temperature, °C |
| oilLevelPct | Double | % of nominal |
| voltageV | Double | secondary line-to-line V |
| currentA | Double | secondary line current A |
| loadPct | Double | % of rated kVA |
| powerFactor | Double? | 0–1 |
| source | ReadingSource | SIMULATED, DEVICE or MANUAL |
| simulationId | String? | simulator run id when SIMULATED |
| scenario | String? | active scenario name when SIMULATED |
| recordedAt | Instant | |

Indexes: `{transformerId:1, recordedAt:-1}` (compound) and `{recordedAt:1}` with **TTL** = `powerpulse.retention.reading-days` (default 90).

Retention: raw readings expire through the TTL. Alerts, incidents, maintenance and audit logs are retained indefinitely.

Units are fixed by field name (`°C`, `%`, `V`, `A`, `%`, ratio) and documented here rather than stored per document.

### `alerts` — `alert.Alert`
| Field | Type | Notes |
|---|---|---|
| id | String | |
| transformerId, transformerCode, transformerName, location | String | denormalized for filtering/search |
| faultType | FaultType | |
| severity | Severity | current (may escalate) |
| peakSeverity | Severity | highest reached |
| description | String | |
| measuredValue | Double? | latest measured value that matched |
| peakValue | Double? | worst value observed while active |
| threshold | Double? | configured threshold that was crossed |
| unit | String | `°C`, `%`, `V`, `A`, `s` |
| status | AlertStatus | indexed |
| active | boolean | true until RESOLVED |
| incidentKey | String | `transformerId:faultType`; **partial unique index where active=true** |
| assignedUserId / assignedUserName | String? | |
| acknowledgedAt / acknowledgedBy | Instant? / String? | |
| resolvedAt / resolvedBy / resolutionNotes | | |
| recovered | boolean | readings returned to normal (auto-detected) |
| recoveredAt | Instant? | |
| consecutiveNormalCount | int | used by the recovery policy |
| recurrenceCount | int | # of previous resolved incidents with the same incidentKey |
| events | List<AlertEvent> | `{at, type, message, actor}`, type ∈ CREATED, ESCALATED, ACKNOWLEDGED, ASSIGNED, STATUS_CHANGED, RECOVERED, RESOLVED, MAINTENANCE_LINKED |
| maintenanceIds | List<String> | |
| createdAt / updatedAt | Instant | indexed createdAt |
| version | Long | `@Version` |

### `fault_incidents` — `faulthistory.FaultIncident`
One per alert (`alertId` **unique**). It is created when the alert opens and finalized when the alert resolves. It is the immutable historical record, while the alert is the live workflow object.

| id | alertId | transformerId | transformerCode | location | faultType | severity (peak) | startedAt | resolvedAt? | durationSeconds? | peakValue | threshold | unit | readings: List<ReadingSnapshot> (opening + peak, ≤ 10) | actionsTaken: List<String> | recurrenceCount | maintenanceIds | resolutionNotes | createdAt | updatedAt |

### `maintenance_tasks` — `maintenance.MaintenanceTask`
| Field | Type | Notes |
|---|---|---|
| id | String | |
| transformerId, transformerCode, transformerName, location | String | |
| alertId | String? | related alert |
| title, description | String | |
| priority | Priority | |
| status | MaintenanceStatus | indexed |
| assignedTechnicianId / assignedTechnicianName | String? | indexed technicianId |
| dueDate | Instant | indexed |
| inspectionFindings | String? | |
| workNotes | List<WorkNote> | `{at, authorId, authorName, text}` |
| partsReplaced | List<PartReplaced> | `{name, quantity, notes}` |
| completedAt | Instant? | |
| cancelledAt / cancelReason | | |
| createdById / createdByName | String | |
| history | List<TaskHistoryEntry> | `{at, actorName, action, detail}` |
| createdAt / updatedAt | Instant | |
| version | Long | |

### `notifications` — `notification.Notification`
| id | recipientId | title | message | type | relatedType (ResourceType) | relatedId | read | readAt | dedupKey | createdAt |

Indexes: **unique** `{recipientId, dedupKey}` and `{recipientId, read, createdAt:-1}`.

### `system_settings` — `settings.SystemSettings` (singleton, id = `global`)
```
thresholds:
  temperatureC:        { good: 65,  warn: 85,  critical: 105 }   # higher is worse
  oilLevelPct:         { good: 80,  warn: 60,  critical: 40 }    # lower is worse
  loadPct:             { good: 70,  warn: 90,  critical: 110 }   # higher is worse
  voltageDeviationPct: { good: 2,   warn: 5,   critical: 10 }    # |V - rated| / rated
  currentPctOfRated:   { good: 75,  warn: 95,  critical: 115 }   # I / I_rated, I_rated = kVA*1000/(√3*V_rated)
sensorTimeoutSeconds: 120
recoveryReadings: 3
healthWeights: { temperature: 30, oilLevel: 25, load: 20, electrical: 15, faultHistory: 10 }  # must sum to 100
notifications: { criticalAlertRoles: [ADMIN, ENGINEER, OPERATOR], offlineRoles: [ADMIN, ENGINEER, OPERATOR],
                 resolvedRoles: [ADMIN, ENGINEER], upcomingInspectionDays: 3 }
locations: [ "North Ridge", "Harbor District", "Eastfield", "Old Town", "Riverside" ]
simulation: { enabled: true, intervalSeconds: 10, noiseFactor: 1.0 }
updatedAt, updatedBy
```
**These threshold values are configurable demo defaults. They are not universal electrical-safety limits.**

### `audit_logs` — `audit.AuditLog`
| id | actorId | actorName | action (e.g. `ALERT_RESOLVED`) | entityType (ResourceType) | entityId | summary | at (indexed desc) |
Passwords, hashes, tokens and device keys are never logged.

### `scheduler_locks` — `common.SchedulerLock`
| id (job name) | lockedUntil | lockedBy |. A lease lock that prevents duplicate scheduler execution.

### `simulation_state` — `simulation.SimulationState` (singleton, id = `global`)
| running | runId | tick | scenarios: Map<transformerId, ActiveScenario{name, startedAt, step}> | updatedAt |
