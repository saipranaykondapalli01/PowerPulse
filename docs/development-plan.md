# PowerPulse — Development Plan and Domain Rules

## Phases
1. Contracts and scaffolding (lead): docs, pom, package.json, shared models, enums, repositories, interfaces, TS types, router.
2. Security and auth (agent).
3. Frontend foundation: UI kit, shell, auth, services, hooks (agent).
4. Landing page (agent).
5. Core domain: transformers, readings, fault detection, alerts, health, settings, simulator, seed (agent).
6. Workflows: maintenance, notifications, fault history, dashboard, reports, audit (agent).
7. Frontend application pages (agent).
8. 3D network (agent).
9. Integration (lead).
10. Testing, QA and hardening.

### File ownership (to avoid conflicting edits)
- **Lead only:** `backend/pom.xml`, `frontend/package.json`, `frontend/src/types/api.ts`, `frontend/src/App.tsx` (router), `docs/*`, shared model/enum/repository classes created in Phase 1. Agents that need changes to these files report them instead of editing.
- Agents may add **new** files only inside their owned packages/dirs, and may fill in the placeholder files they own.

## Fault detection rules (`FaultDetectionService`)
Thresholds come from `SystemSettings.thresholds` (configurable demo defaults, **not universal safety limits**). Rules are evaluated per reading and are pure (no side effects).

Severity band for a "higher is worse" metric with `warn < critical`: let `mid = (warn + critical) / 2`.
- `value < warn` → no finding
- `warn ≤ value < mid` → **MEDIUM**
- `mid ≤ value < critical` → **HIGH**
- `value ≥ critical` → **CRITICAL**

"Lower is worse" metrics (oil level) are mirrored.

| Fault | Metric | Unit | Notes |
|---|---|---|---|
| OVERHEATING | temperatureC | °C | higher is worse |
| LOW_OIL_LEVEL | oilLevelPct | % | lower is worse |
| OVERLOADING | loadPct | % | higher is worse |
| ABNORMAL_VOLTAGE | \|voltageV − secondaryVoltageV\| / secondaryVoltageV × 100 | % deviation (measuredValue = voltageV in V, threshold = V bound crossed) | higher is worse |
| ABNORMAL_CURRENT | currentA / I_rated × 100, I_rated = kVA·1000 / (√3 · secondaryVoltageV) | % of rated (measuredValue = currentA in A, threshold = A bound) | higher is worse |
| SENSOR_FAILURE | any required value null/NaN, or outside physical range: temp ∉ [-40, 200], oil ∉ [0, 100], voltage < 0 or > 2× rated, current < 0, load ∉ [0, 300], PF ∉ [0, 1] | — | **HIGH**. Other rules skip the invalid metric. |
| STALE_READING | now − lastReadingAt > sensorTimeoutSeconds | s | Evaluated by `StaleReadingJob` (every 30s), not per reading. **HIGH**. Sets status OFFLINE. |

LOW severity is reserved for informational, manually raised alerts. Automatic rules start at MEDIUM.

## Alert deduplication, escalation, recovery, recurrence (`AlertService.reconcile`)
- `incidentKey = transformerId + ":" + faultType`. At most **one active** alert per key, enforced by a partial unique index.
- **Finding present and no active alert:** create alert (status NEW, `recurrenceCount` = number of previously resolved alerts with the same key) and open a `FaultIncident`. If the severity is CRITICAL, send a NEW_CRITICAL_ALERT notification. A `DuplicateKeyException` means another execution already created the alert, so the service re-reads it and continues (scheduler-safe).
- **Finding present and active alert exists:** update `measuredValue`, keep `peakValue` and `peakSeverity` at their worst, and reset `consecutiveNormalCount = 0`. If the new severity is higher than the current one: **escalate** (set severity, add an ESCALATED event, and send NEW_CRITICAL_ALERT if it reaches CRITICAL). Severity is never de-escalated automatically. If the alert was flagged `recovered`, clear the flag (the fault returned).
- **No finding and active alert exists (recovery policy):** increment `consecutiveNormalCount`. When it reaches `recoveryReadings` (default 3):
  - Status NEW (nobody has engaged with it): **auto-resolve**. Set status RESOLVED, `resolvedBy = "system"`, and resolutionNotes "Auto-resolved: N consecutive readings within normal range." Finalize the incident and notify INCIDENT_RESOLVED.
  - Status ACKNOWLEDGED or IN_PROGRESS: set `recovered=true` and `recoveredAt`, add a RECOVERED event, and **leave it open** for a human to resolve with notes. Human work is never closed silently.
- **Recurrence:** after resolution, a new finding creates a new alert and incident with `recurrenceCount + 1`. Recurrence feeds the fault-history health penalty.
- **Missing readings:** handled only by STALE_READING. That alert recovers (same policy) when fresh readings arrive.
- **Manual resolve** (`/alerts/{id}/resolve`) requires notes. It finalizes the incident (duration, notes, actions) and notifies INCIDENT_RESOLVED.

## Health score (`TransformerHealthService`)
`score = clamp(round(100 − P_temp − P_oil − P_load − P_elec − P_hist), 0, 100)`

Each penalty uses a linear ramp: `ramp(v, good, critical) = clamp((v − good) / (critical − good), 0, 1)` (mirrored for lower-is-worse metrics).

| Factor | Formula | Max (weight) |
|---|---|---|
| temperature | W_temp × ramp(temperatureC, good 65, critical 105) | 30 |
| oilLevel | W_oil × ramp_low(oilLevelPct, good 80, critical 40) | 25 |
| load | W_load × ramp(loadPct, good 70, critical 110) | 20 |
| electrical | W_elec × max(ramp(voltageDev%, 2, 10), ramp(current%, 75, 115)) | 15 |
| faultHistory | min(W_hist, 3 × activeAlerts + 1 × resolvedIncidentsLast30Days) | 10 |

Weights and the good/critical points come from settings. Every factor is returned as `HealthFactor {factor, penalty, maxPenalty, detail}`.

The score is a transparent heuristic for prioritization. **It is not a statistically validated probability of failure.**

### Status derivation (separate from the score)
1. No reading, or reading older than the sensor timeout (or an active STALE_READING alert) → **OFFLINE**
2. Any active alert with severity HIGH or CRITICAL, or score < 40 → **CRITICAL**
3. Any active alert, or score < 70 → **WARNING**
4. Otherwise → **HEALTHY**

### Network health (dashboard)
Capacity-weighted mean of `healthScore` over non-OFFLINE transformers: `Σ(score·kVA)/Σ(kVA)`, rounded. It is null when there are none.

## Recommendations (transformer details)
These are rule-based suggestions derived from the active alerts and latest reading, and are labeled "suggested inspection actions, not a diagnosis". Examples:
- OVERHEATING → "Inspect cooling fins and fans; check for blocked radiators; verify load profile."
- LOW_OIL_LEVEL → "Inspect for oil leaks at gaskets and valves; check the conservator and sight glass."
- OVERLOADING → "Review connected load; consider load transfer to adjacent transformer."
- ABNORMAL_VOLTAGE → "Check tap changer position and upstream supply voltage."
- ABNORMAL_CURRENT → "Check for phase imbalance or downstream faults."
- SENSOR_FAILURE → "Verify sensor wiring and calibration."
- STALE_READING → "Check gateway connectivity and power to the monitoring unit."
- Health < 60 with no active alert → "Schedule a routine inspection."

## Simulator
- One scheduled job (`fixedDelay = simulation.intervalSeconds`), guarded by `SchedulerLockService`, that does nothing when `running=false`.
- Each tick generates one reading per transformer via `ReadingIngestionService` with `source=SIMULATED` and `simulationId=runId`.
- Baseline: a bounded mean-reverting random walk around a per-transformer nominal profile (seeded deterministically from the transformer code):
  - temp 50–70 °C, oil 85–98 %, load 40–75 %
  - voltage ±1.5 % of rated, current derived from load, PF 0.88–0.97
- Scenarios (per transformer; deterministic step scripts that override the walk):

| Scenario | Behavior |
|---|---|
| healthy | nominal values |
| rising-temperature | temperature +4 °C per tick up to ~95 °C (WARNING → HIGH) |
| low-oil | oil drops 5 %/tick to ~35 % |
| overloading | load climbs to ~118 % (current follows) |
| critical-overheating | temperature jumps to 110–115 °C immediately |
| offline | the simulator **skips** this transformer, so STALE_READING fires after the timeout |
| return-to-normal | values ramp back to nominal over ~3 ticks, then the scenario is cleared, which triggers the recovery policy |

- Reset clears all scenarios and restores nominal behavior. It does not delete history.
- All simulated data is labeled SIMULATED in the API and UI. It is not real IoT telemetry.

## Dev seed (`DevDataSeeder`, profile `dev`, idempotent: runs only when collections are empty)
- Users from security.md and one demo device.
- 20 transformers across 5 locations (4 each). Capacities are 100–1000 kVA, primary 11 kV, secondary 415 V. Grid positions are laid out in clusters per location, with `connectedTo` forming a radial feeder per location plus inter-location ties.
- 24h of backfilled readings at 10-minute intervals per transformer (generated by the simulator's baseline). A few transformers are given pre-seeded scenarios so the initial state shows WARNING and CRITICAL examples.
