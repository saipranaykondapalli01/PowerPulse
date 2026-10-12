# PowerPulse — Architecture

## Overview
```
 Browser (React SPA, Vite dev :5173)
   │  /api/v1/*  (same-origin via Vite proxy in dev; cookie auth + CSRF header)
   ▼
 Spring Boot API (:8080)  ── controllers → services → repositories ──►  MongoDB (:27017, db "powerpulse")
   ▲                          ▲
   │ X-Device-Key             │ @Scheduled jobs (lease-locked): simulator tick, stale-reading check,
 Sensor gateways (future)     │ maintenance overdue/upcoming check
```

## Backend module layout (`backend/src/main/java/com/powerpulse/`)
| Package | Responsibility |
|---|---|
| `config` | Mongo auditing/indexes, scheduling, Jackson, OpenAPI, dev seed (`DevUserSeeder` for users and the demo device, `DevDataSeeder` for transformers and readings; profile `dev`) |
| `common` | `ApiError`, `PageResponse`, exceptions, `GlobalExceptionHandler`, `SchedulerLockService`, `CurrentUser` helper, shared enums |
| `security`, `auth`, `user` | JWT cookie auth, CSRF, CORS, device-key filter, login/logout/me, user admin |
| `transformer` | Transformer registry CRUD, list/filter/sort, recommendations |
| `reading` | `SensorReading`, `ReadingIngestionService` (the single pipeline for all readings) |
| `fault` | `FaultDetectionService` with rule evaluation, `StaleReadingJob` |
| `alert` | Alert workflow, dedup/escalation/recovery/recurrence (`AlertService`) |
| `health` | `TransformerHealthService` (scoring and status derivation) |
| `maintenance` | Maintenance task lifecycle |
| `notification` | Persistent in-app notifications |
| `faulthistory` | `FaultIncident` history |
| `dashboard`, `reports` | Aggregations and CSV export |
| `settings` | `SystemSettings` singleton with cached access |
| `audit` | `AuditService` and admin audit-log API |
| `simulation` | Simulator scheduler, scenarios, controls |

Rules: controllers are thin (validation and delegation only). All business logic lives in services, and DTOs are mapped in services or in `*Mapper` classes.

## Reading pipeline (single path for device and simulated readings)
```
ReadingIngestionService.ingest(ReadingInput, source, simulationId?)
  1. validate & persist SensorReading
  2. update Transformer.latestReading / lastReadingAt
  3. FaultDetectionService.evaluate(transformer, reading)    -> List<FaultFinding>  (pure, no side effects)
  4. AlertService.reconcile(transformer, findings, reading)  -> open / escalate / track recovery (dedup by incidentKey)
       ├─ FaultIncidentService.open/finalize
       └─ NotificationService.notifyNewCriticalAlert / notifyIncidentResolved
  5. TransformerHealthService.assess(transformer, reading)    -> HealthAssessment(score, factors, status)
  6. persist Transformer (score, factors, status, activeFaultCount)
```
`StaleReadingJob` runs every 30s and evaluates `STALE_READING` for transformers whose `lastReadingAt` is older than `sensorTimeoutSeconds`. When it fires, it sets status OFFLINE and sends a TRANSFORMER_OFFLINE notification (deduped per offline episode).

## Concurrency and consistency
- MongoDB in dev is a standalone server (no multi-document transactions), so each workflow step is idempotent:
  - The partial unique index on `alerts.incidentKey` (active only) means a duplicate insert raises `DuplicateKeyException`, which the service treats as "already open" and re-reads.
  - Unique `notifications.{recipientId,dedupKey}` prevents duplicate notifications.
  - Unique `fault_incidents.alertId` prevents duplicate incidents.
  - Scheduled jobs acquire a lease in `scheduler_locks` (`SchedulerLockService.tryRun(name, lease, runnable)`).
- `@Version` on Transformer, Alert and MaintenanceTask provides optimistic locking.

## Frontend layout (`frontend/src/`)
| Dir | Responsibility |
|---|---|
| `styles/tokens.css`, `tailwind.config.ts` | Design tokens (shared by landing and app) |
| `services/` | `apiClient.ts` plus one service module per domain. **No business logic.** |
| `hooks/` | TanStack Query hooks (`queryKeys.ts` factory, polling) |
| `context/AuthContext.tsx` | Current user, login/logout |
| `components/ui` | Design-system primitives |
| `components/layout` | `AppShell`, `Sidebar`, `TopBar`, `ProtectedRoute`, `RoleGate` |
| `components/{dashboard,transformers,alerts,maintenance,charts}` | Feature components |
| `three/` | R3F network scene, models, HUD, 2D fallback |
| `pages/` | Route pages; `pages/landing/` for the editorial landing page |
| `types/api.ts` | TypeScript mirror of backend DTOs (authoritative for FE) |

Polling: monitoring queries refetch every 10s (`POLL_MS`). Mutations invalidate affected query keys. The architecture can move to WebSocket/SSE later by replacing the polling in hooks.

## Health and status model
See `docs/development-plan.md` §Health for the formula. Health score and fault severity are separate signals: a CRITICAL alert forces status CRITICAL even when the score is high.
