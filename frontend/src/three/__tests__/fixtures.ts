import type { DashboardSummary, TransformerDto, TransformerStatus } from '@/types/api';

export function makeTransformer(over: Partial<TransformerDto> & { id: string }): TransformerDto {
  const status: TransformerStatus = over.status ?? 'HEALTHY';
  return {
    code: over.id.toUpperCase(),
    name: `Transformer ${over.id}`,
    location: 'North Yard',
    latitude: 0,
    longitude: 0,
    gridX: 0,
    gridZ: 0,
    connectedTo: [],
    ratedCapacityKva: 500,
    primaryVoltageKv: 11,
    secondaryVoltageV: 415,
    healthScore: 90,
    status,
    latestReading: {
      temperatureC: 61.5,
      oilLevelPct: 88,
      voltageV: 414,
      currentA: 320,
      loadPct: 64,
      powerFactor: 0.95,
      recordedAt: '2026-10-09T10:00:00Z',
      source: 'SIMULATED',
    },
    lastReadingAt: '2026-10-09T10:00:00Z',
    readingAgeSeconds: 12,
    stale: false,
    lastMaintenanceAt: null,
    activeFaultCount: 0,
    highestActiveSeverity: null,
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

export const transformers: TransformerDto[] = [
  makeTransformer({ id: 'tx-001', gridX: 0, gridZ: 0, connectedTo: ['tx-002'], status: 'HEALTHY', healthScore: 92 }),
  makeTransformer({
    id: 'tx-002',
    gridX: 10,
    gridZ: 0,
    connectedTo: ['tx-001', 'tx-003'],
    status: 'CRITICAL',
    healthScore: 35,
    activeFaultCount: 2,
    highestActiveSeverity: 'CRITICAL',
    location: 'South Yard',
  }),
  makeTransformer({
    id: 'tx-003',
    gridX: 10,
    gridZ: 10,
    connectedTo: ['tx-002'],
    status: 'OFFLINE',
    healthScore: 50,
    stale: true,
    latestReading: null,
    readingAgeSeconds: null,
  }),
];

/** Deliberately different from what `transformers` would derive, to prove where HUD numbers come from. */
export const summary: DashboardSummary = {
  totalTransformers: 42,
  healthy: 30,
  warning: 7,
  critical: 3,
  offline: 2,
  networkHealth: 81,
  totalLoadKva: 12_500,
  totalCapacityKva: 25_000,
  activeAlerts: 9,
  activeCriticalAlerts: 3,
  pendingMaintenance: 0,
  overdueMaintenance: 0,
  recentIncidents: [],
  recentMaintenance: [],
  generatedAt: '2026-10-09T10:00:00Z',
};
