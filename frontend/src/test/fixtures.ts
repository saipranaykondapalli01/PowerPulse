/** Test-only fixtures. Never imported by shipped code. */
import type { DashboardSummary, PageResponse, SimulationStatus, TransformerDto } from '@/types/api';

export function makeTransformer(over: Partial<TransformerDto> = {}): TransformerDto {
  return {
    id: 't1',
    code: 'PP-TX-001',
    name: 'Riverside 1',
    location: 'Riverside',
    latitude: 12.9,
    longitude: 77.6,
    gridX: 0,
    gridZ: 0,
    connectedTo: [],
    ratedCapacityKva: 500,
    primaryVoltageKv: 11,
    secondaryVoltageV: 415,
    healthScore: 88,
    status: 'HEALTHY',
    latestReading: {
      temperatureC: 61.2,
      oilLevelPct: 92,
      voltageV: 414,
      currentA: 420,
      loadPct: 58,
      powerFactor: 0.93,
      recordedAt: new Date().toISOString(),
      source: 'SIMULATED',
    },
    lastReadingAt: new Date().toISOString(),
    readingAgeSeconds: 3,
    stale: false,
    lastMaintenanceAt: null,
    activeFaultCount: 0,
    highestActiveSeverity: null,
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

export function page<T>(content: T[], over: Partial<PageResponse<T>> = {}): PageResponse<T> {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1, ...over };
}

export function makeSummary(over: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    totalTransformers: 37,
    healthy: 21,
    warning: 9,
    critical: 4,
    offline: 3,
    networkHealth: 73,
    totalLoadKva: 4321,
    totalCapacityKva: 9876,
    activeAlerts: 17,
    activeCriticalAlerts: 5,
    pendingMaintenance: 11,
    overdueMaintenance: 2,
    recentIncidents: [],
    recentMaintenance: [],
    generatedAt: new Date().toISOString(),
    ...over,
  };
}

export function makeSimStatus(over: Partial<SimulationStatus> = {}): SimulationStatus {
  return {
    enabled: true,
    running: true,
    runId: 'run-1',
    tick: 42,
    intervalSeconds: 10,
    scenarios: [],
    availableScenarios: ['healthy', 'rising-temperature', 'low-oil', 'overloading', 'critical-overheating', 'offline', 'return-to-normal'],
    lastTickAt: new Date().toISOString(),
    ...over,
  };
}
