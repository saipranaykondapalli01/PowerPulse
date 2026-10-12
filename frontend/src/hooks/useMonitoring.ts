import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from './queryKeys';
import { POLL_MS } from './queryClient';
import { dashboardService } from '@/services/dashboardService';
import { transformerService } from '@/services/transformerService';
import { simulationService } from '@/services/simulationService';
import { publicService } from '@/services/publicService';
import type {
  DashboardFilters,
  ManualReadingRequest,
  Instant,
  ScenarioName,
  TransformerListParams,
  TransformerUpsertRequest,
} from '@/types/api';

// ---- Dashboard ----
export const useDashboardSummary = (f: DashboardFilters = {}) =>
  useQuery({ queryKey: qk.dashboard.summary(f), queryFn: () => dashboardService.summary(f), refetchInterval: POLL_MS });

export const useDashboardTrends = (f: DashboardFilters = {}) =>
  useQuery({ queryKey: qk.dashboard.trends(f), queryFn: () => dashboardService.trends(f), refetchInterval: POLL_MS * 3 });

export const useHealthDistribution = (f: Pick<DashboardFilters, 'location'> = {}) =>
  useQuery({
    queryKey: qk.dashboard.health(f),
    queryFn: () => dashboardService.healthDistribution(f),
    refetchInterval: POLL_MS,
  });

export const useFaultFrequency = (f: DashboardFilters = {}) =>
  useQuery({ queryKey: qk.dashboard.faults(f), queryFn: () => dashboardService.faultFrequency(f), refetchInterval: POLL_MS * 3 });

// ---- Transformers ----
export const useTransformerList = (p: TransformerListParams) =>
  useQuery({
    queryKey: qk.transformers.list(p),
    queryFn: () => transformerService.list(p),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  });

/** Every transformer, unpaged. Shared source of truth for the 3D grid, HUD and pickers. */
export const useAllTransformers = () =>
  useQuery({ queryKey: qk.transformers.everything, queryFn: transformerService.all, refetchInterval: POLL_MS });

export const useLocations = () =>
  useQuery({ queryKey: qk.transformers.locations, queryFn: transformerService.locations, staleTime: 60_000 });

export const useTransformer = (id: string | undefined) =>
  useQuery({
    queryKey: qk.transformers.detail(id ?? ''),
    queryFn: () => transformerService.get(id!),
    enabled: !!id,
    refetchInterval: POLL_MS,
  });

export const useTransformerReadings = (id: string | undefined, p: { from?: Instant; to?: Instant; maxPoints?: number }) =>
  useQuery({
    queryKey: qk.transformers.readings(id ?? '', p),
    queryFn: () => transformerService.readings(id!, p),
    enabled: !!id,
    refetchInterval: POLL_MS * 3,
    placeholderData: keepPreviousData,
  });

export const useTransformerAlerts = (id: string | undefined, p: { active?: boolean } = {}) =>
  useQuery({
    queryKey: qk.transformers.alerts(id ?? '', p),
    queryFn: () => transformerService.alerts(id!, p),
    enabled: !!id,
    refetchInterval: POLL_MS,
  });

export const useTransformerMaintenance = (id: string | undefined) =>
  useQuery({
    queryKey: qk.transformers.maintenance(id ?? ''),
    queryFn: () => transformerService.maintenance(id!),
    enabled: !!id,
  });

export const useTransformerIncidents = (id: string | undefined) =>
  useQuery({
    queryKey: qk.transformers.incidents(id ?? ''),
    queryFn: () => transformerService.incidents(id!),
    enabled: !!id,
  });

export function useCreateTransformer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransformerUpsertRequest) => transformerService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.transformers.all });
      qc.invalidateQueries({ queryKey: qk.dashboard.all });
    },
  });
}

export function useUpdateTransformer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransformerUpsertRequest) => transformerService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.transformers.all });
      qc.invalidateQueries({ queryKey: qk.dashboard.all });
    },
  });
}

/** Records a manual reading. A new reading can change alerts, health, status, dashboard counts and notifications. */
export function useRecordReading(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualReadingRequest) => transformerService.recordReading(id, body),
    onSuccess: () => {
      for (const key of [qk.transformers.all, qk.dashboard.all, qk.alerts.all, qk.simulation, qk.notifications.all]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

// ---- Simulation ----
export const useSimulationStatus = () =>
  useQuery({ queryKey: qk.simulation, queryFn: simulationService.status, refetchInterval: POLL_MS });

/** After a simulation change, everything derived from readings may change. */
function useInvalidateMonitoring() {
  const qc = useQueryClient();
  return () => {
    for (const key of [qk.simulation, qk.transformers.all, qk.dashboard.all, qk.alerts.all, qk.notifications.all]) {
      qc.invalidateQueries({ queryKey: key });
    }
  };
}

export function useSimulationControl() {
  const invalidate = useInvalidateMonitoring();
  return {
    start: useMutation({ mutationFn: simulationService.start, onSuccess: invalidate }),
    pause: useMutation({ mutationFn: simulationService.pause, onSuccess: invalidate }),
    reset: useMutation({ mutationFn: simulationService.reset, onSuccess: invalidate }),
    scenario: useMutation({
      mutationFn: ({ name, transformerId }: { name: ScenarioName; transformerId: string }) =>
        simulationService.runScenario(name, transformerId),
      onSuccess: invalidate,
    }),
  };
}

// ---- Public ----
export const usePublicNetworkPreview = () =>
  useQuery({ queryKey: qk.publicPreview, queryFn: publicService.networkPreview, refetchInterval: POLL_MS * 2 });
