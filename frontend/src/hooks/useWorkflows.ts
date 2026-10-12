import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from './queryKeys';
import { POLL_MS } from './queryClient';
import { alertService } from '@/services/alertService';
import { maintenanceService } from '@/services/maintenanceService';
import { faultHistoryService } from '@/services/faultHistoryService';
import { notificationService } from '@/services/notificationService';
import type {
  AlertListParams,
  AlertUpdateRequest,
  FaultHistoryParams,
  MaintenanceCompleteRequest,
  MaintenanceCreateRequest,
  MaintenanceListParams,
  MaintenanceUpdateRequest,
  NotificationListParams,
} from '@/types/api';

/** Alert or maintenance changes affect transformer status, dashboard counts and history. */
function useInvalidateWorkflow() {
  const qc = useQueryClient();
  return () => {
    for (const key of [qk.alerts.all, qk.maintenance.all, qk.transformers.all, qk.dashboard.all, qk.faultHistory.all, qk.notifications.all]) {
      qc.invalidateQueries({ queryKey: key });
    }
  };
}

// ---- Alerts ----
export const useAlertList = (p: AlertListParams) =>
  useQuery({
    queryKey: qk.alerts.list(p),
    queryFn: () => alertService.list(p),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  });

export const useAlert = (id: string | undefined) =>
  useQuery({ queryKey: qk.alerts.detail(id ?? ''), queryFn: () => alertService.get(id!), enabled: !!id });

export function useAlertActions() {
  const onSuccess = useInvalidateWorkflow();
  return {
    acknowledge: useMutation({ mutationFn: (id: string) => alertService.acknowledge(id), onSuccess }),
    assign: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) => alertService.assign(id, userId),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: AlertUpdateRequest }) => alertService.update(id, body),
      onSuccess,
    }),
    resolve: useMutation({
      mutationFn: ({ id, notes }: { id: string; notes: string }) => alertService.resolve(id, notes),
      onSuccess,
    }),
  };
}

// ---- Maintenance ----
export const useMaintenanceList = (p: MaintenanceListParams) =>
  useQuery({
    queryKey: qk.maintenance.list(p),
    queryFn: () => maintenanceService.list(p),
    refetchInterval: POLL_MS * 3,
    placeholderData: keepPreviousData,
  });

export const useMaintenanceTask = (id: string | undefined) =>
  useQuery({ queryKey: qk.maintenance.detail(id ?? ''), queryFn: () => maintenanceService.get(id!), enabled: !!id });

export function useMaintenanceActions() {
  const onSuccess = useInvalidateWorkflow();
  return {
    create: useMutation({ mutationFn: (body: MaintenanceCreateRequest) => maintenanceService.create(body), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: MaintenanceUpdateRequest }) => maintenanceService.update(id, body),
      onSuccess,
    }),
    complete: useMutation({
      mutationFn: ({ id, body }: { id: string; body?: MaintenanceCompleteRequest }) =>
        maintenanceService.complete(id, body),
      onSuccess,
    }),
  };
}

// ---- Fault history ----
export const useFaultHistory = (p: FaultHistoryParams) =>
  useQuery({
    queryKey: qk.faultHistory.list(p),
    queryFn: () => faultHistoryService.list(p),
    placeholderData: keepPreviousData,
  });

// ---- Notifications ----
export const useNotifications = (p: NotificationListParams) =>
  useQuery({
    queryKey: qk.notifications.list(p),
    queryFn: () => notificationService.list(p),
    refetchInterval: POLL_MS * 3,
    placeholderData: keepPreviousData,
  });

export const useUnreadCount = () =>
  useQuery({ queryKey: qk.notifications.unread, queryFn: notificationService.unreadCount, refetchInterval: POLL_MS * 2 });

export function useNotificationActions() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: qk.notifications.all });
  return {
    markRead: useMutation({ mutationFn: (id: string) => notificationService.markRead(id), onSuccess }),
    markAllRead: useMutation({ mutationFn: notificationService.markAllRead, onSuccess }),
  };
}
