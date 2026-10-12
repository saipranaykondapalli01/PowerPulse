import { useQuery } from '@tanstack/react-query';
import { qk } from './queryKeys';
import { POLL_MS } from './queryClient';
import { alertService } from '@/services/alertService';
import { maintenanceService } from '@/services/maintenanceService';
import type { AlertListParams, MaintenanceListParams } from '@/types/api';

type CountFilter<P> = Omit<P, 'page' | 'size' | 'sort'>;

/**
 * Real count of alerts matching `filter`: a size=1 list request, reading `totalElements`.
 * Keys live under qk.alerts so workflow mutations invalidate them with the lists.
 */
export function useAlertCount(filter: CountFilter<AlertListParams>, enabled = true) {
  const params: AlertListParams = { ...filter, page: 0, size: 1 };
  return useQuery({
    queryKey: qk.alerts.list(params),
    queryFn: () => alertService.list(params),
    select: (d) => d.totalElements,
    refetchInterval: POLL_MS,
    enabled,
  });
}

/** Real count of maintenance tasks matching `filter` (server-scoped to the technician for technicians). */
export function useMaintenanceCount(filter: CountFilter<MaintenanceListParams>, enabled = true) {
  const params: MaintenanceListParams = { ...filter, page: 0, size: 1 };
  return useQuery({
    queryKey: qk.maintenance.list(params),
    queryFn: () => maintenanceService.list(params),
    select: (d) => d.totalElements,
    refetchInterval: POLL_MS * 3,
    enabled,
  });
}
