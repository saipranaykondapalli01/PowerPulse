# PowerPulse — API Contracts (`/api/v1`)

DTO shapes are defined **once** in `frontend/src/types/api.ts`, and Java DTOs (records) mirror them field-for-field (same names, camelCase JSON). The type names below refer to that file.

## Conventions
- JSON only (except CSV export). Timestamps are ISO-8601 UTC strings. Ids are strings.
- **Pagination:** `?page=0&size=20&sort=field,asc|desc` → `PageResponse<T> {content, page, size, totalElements, totalPages}`. Size is capped at 200.
- **Errors:** every non-2xx response returns `ApiError`:
  ```json
  {"timestamp":"…","status":400,"error":"Bad Request","code":"VALIDATION_FAILED",
   "message":"Request validation failed","path":"/api/v1/transformers",
   "fieldErrors":[{"field":"ratedCapacityKva","message":"must be greater than 0"}]}
  ```
  Codes: VALIDATION_FAILED (400), BAD_REQUEST (400), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409, e.g. duplicate code, illegal state transition, optimistic lock), TOO_MANY_REQUESTS (429, login throttle: 5 failures per email per 15 min), INTERNAL_ERROR (500).
- Status codes: 200 OK, 201 Created (POST that creates, with body), 204 No Content (logout, read-all).
- Mutations require the `X-XSRF-TOKEN` header (see security.md).

## Auth
| Method | Path | Body → Response | Roles |
|---|---|---|---|
| GET | /auth/csrf | → 204 (sets XSRF-TOKEN cookie) | public |
| POST | /auth/login | `LoginRequest` → `UserDto` + Set-Cookie | public |
| POST | /auth/logout | → 204 | any |
| GET | /auth/me | → `UserDto` | authenticated |

## Users (lookup)
| GET | /users/assignable?role=TECHNICIAN | → `UserSummary[]` (active users, optional role filter) | ADMIN, ENGINEER, OPERATOR |

## Dashboard
Shared filters: `location?`, `status?`, `from?`, `to?` (ISO).
| GET | /dashboard/summary | → `DashboardSummary` | all |
| GET | /dashboard/trends?from&to&location&bucket=HOUR | → `TrendPoint[]` (avg temp, avg load, per bucket) | all |
| GET | /dashboard/health-distribution?location | → `HealthBucket[]` (0–19, 20–39, 40–59, 60–79, 80–100) | all |
| GET | /dashboard/fault-frequency?from&to&location | → `FaultFrequency[]` | all |

## Transformers
| GET | /transformers?q&location&status&minCapacity&maxCapacity&minHealth&maxHealth&page&size&sort | → `PageResponse<TransformerDto>`. Sort fields: `code, name, healthScore, status, latestReading.temperatureC, latestReading.oilLevelPct, latestReading.loadPct, lastReadingAt, ratedCapacityKva` | all |
| GET | /transformers/all | → `TransformerDto[]` (unpaged, used by 3D grid and HUD) | all |
| GET | /transformers/locations | → `string[]` | all |
| POST | /transformers | `TransformerUpsertRequest` → 201 `TransformerDto` | ADMIN, ENGINEER |
| GET | /transformers/{id} | → `TransformerDetailDto` (transformer + recommendations + health factors) | all |
| PATCH | /transformers/{id} | `TransformerUpsertRequest` (partial: null fields ignored) → `TransformerDto` | ADMIN, ENGINEER |
| GET | /transformers/{id}/readings?from&to&maxPoints=500 | → `ReadingDto[]` ascending; downsampled by time bucket average when > maxPoints | all |
| POST | /transformers/{id}/readings | `ManualReadingRequest` → 201 `ReadingDto` (source `MANUAL`). Impossible values → 400 (not SENSOR_FAILURE); voltage > 2× rated, future or > 7-day-old `recordedAt` → 400. `holdFromSimulator` (default true) applies the `manual` scenario so the simulator skips the unit. Same fault/alert/health pipeline as device readings; audited `READING_RECORDED_MANUALLY`. | ADMIN, ENGINEER, TECHNICIAN |
| GET | /transformers/{id}/alerts?active | → `AlertDto[]` | all |
| GET | /transformers/{id}/maintenance | → `MaintenanceDto[]` (technician: only own) | all |
| GET | /transformers/{id}/incidents | → `FaultIncidentDto[]` | all |

## Readings (device ingestion)
| POST | /readings | `ReadingInput` → 201 `ReadingDto` | `X-Device-Key` |

## Alerts
| GET | /alerts?q&status&severity&faultType&transformerId&location&active&from&to&page&size&sort | → `PageResponse<AlertDto>` | all |
| GET | /alerts/{id} | → `AlertDto` | all |
| PATCH | /alerts/{id} | `AlertUpdateRequest {status?}` (only forward transitions NEW→ACKNOWLEDGED→IN_PROGRESS; RESOLVED via /resolve) → `AlertDto` | ADMIN, ENGINEER, OPERATOR |
| POST | /alerts/{id}/acknowledge | → `AlertDto` | ADMIN, ENGINEER, OPERATOR |
| POST | /alerts/{id}/assign | `{userId}` → `AlertDto` | ADMIN, ENGINEER, OPERATOR |
| POST | /alerts/{id}/resolve | `{resolutionNotes}` (required, ≥ 5 chars) → `AlertDto` | ADMIN, ENGINEER |

## Maintenance
| GET | /maintenance?q&status&priority&technicianId&transformerId&overdue&upcoming&page&size&sort | → `PageResponse<MaintenanceDto>` (technician: forced to own) | all |
| POST | /maintenance | `MaintenanceCreateRequest` → 201 `MaintenanceDto` (status ASSIGNED if technician given, else PENDING) | ADMIN, ENGINEER |
| GET | /maintenance/{id} | → `MaintenanceDto` (technician: own only, else 403) | all |
| PATCH | /maintenance/{id} | `MaintenanceUpdateRequest` (title, description, priority, dueDate, assignedTechnicianId, status, inspectionFindings, addWorkNote, addPart, cancelReason) → `MaintenanceDto` | see matrix: field-level checks in service |
| POST | /maintenance/{id}/complete | `{inspectionFindings?, workNote?}` → `MaintenanceDto` | ADMIN, ENGINEER, assigned TECHNICIAN |

Status transitions: PENDING→ASSIGNED (on assignment), ASSIGNED→IN_PROGRESS, IN_PROGRESS→COMPLETED (via /complete), PENDING|ASSIGNED|IN_PROGRESS→CANCELLED (ADMIN/ENGINEER, reason required). COMPLETED and CANCELLED are terminal. Anything else returns 409.

## Fault history
| GET | /fault-history?transformerId&location&faultType&severity&from&to&page&size&sort | → `PageResponse<FaultIncidentDto>` | all |

## Notifications (always scoped to the current user)
| GET | /notifications?read&type&page&size | → `PageResponse<NotificationDto>` | any |
| GET | /notifications/unread-count | → `{count}` | any |
| PATCH | /notifications/{id}/read | → `NotificationDto` | owner |
| POST | /notifications/read-all | → 204 | any |

## Reports (`from`, `to`, `location` filters)
| GET | /reports/summary | → `ReportSummary` | ADMIN, ENGINEER, OPERATOR |
| GET | /reports/fault-frequency | → `FaultFrequency[]` | same |
| GET | /reports/maintenance | → `MaintenanceReport` | same |
| GET | /reports/transformer-health | → `TransformerHealthReportRow[]` (sorted by health asc; `highRisk` flag when score < 60 or active critical) | same |
| GET | /reports/incident-durations | → `IncidentDurationRow[]` (per fault type: count, avg, max duration s) | same |
| GET | /reports/downtime | → `DowntimeRow[]` (per transformer: offline incidents, total offline seconds) | same |
| GET | /reports/export.csv?type=transformer-health\|fault-history\|maintenance\|readings&from&to&location&transformerId | → `text/csv` stream | same |

## Admin
| GET | /admin/users?q&role&page&size | → `PageResponse<UserDto>` | ADMIN |
| POST | /admin/users | `UserCreateRequest` → 201 `UserDto` | ADMIN |
| PATCH | /admin/users/{id} | `UserUpdateRequest` (name, role, region, active, password?; absent region = unchanged, null/blank = all regions; self-demotion/deactivation and removing the last active ADMIN → 409) → `UserDto` | ADMIN |
| GET | /admin/audit-logs?actor&entityType&action&from&to&page&size | → `PageResponse<AuditLogDto>` | ADMIN |

## Settings
| GET | /settings | → `SystemSettingsDto` | ADMIN, ENGINEER |
| PATCH | /settings | `SystemSettingsDto` (partial) → `SystemSettingsDto`. Validated: warn/critical ordering per threshold direction; weights sum to 100. | ADMIN |

## Simulation
| GET | /simulation/status | → `SimulationStatus` | all |
| POST | /simulation/start | → `SimulationStatus` | ADMIN, ENGINEER |
| POST | /simulation/pause | → `SimulationStatus` | ADMIN, ENGINEER |
| POST | /simulation/reset | → `SimulationStatus` (clears scenarios; all transformers return to nominal behavior) | ADMIN, ENGINEER |
| POST | /simulation/scenarios/{scenarioName}?transformerId= | → `SimulationStatus`. Scenario names: `healthy, rising-temperature, low-oil, overloading, critical-overheating, offline, return-to-normal, manual` (`manual`: the simulator skips the unit because readings are entered by users; `healthy` clears it) | ADMIN, ENGINEER |

## Public
| GET | /public/network-preview | → `NetworkPreviewNode[]` (sanitized, all marked simulated) | public |

## Actuator
`/actuator/health` (public) and `/actuator/info`.
