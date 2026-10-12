import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from './queryKeys';
import { adminService, userService } from '@/services/adminService';
import { reportService } from '@/services/reportService';
import { settingsService } from '@/services/settingsService';
import type {
  AuditLogParams,
  PageParams,
  ReportFilters,
  Role,
  SystemSettingsPatch,
  UserCreateRequest,
  UserUpdateRequest,
} from '@/types/api';

// ---- Reports ----
export const useReportSummary = (f: ReportFilters) =>
  useQuery({ queryKey: qk.reports.report('summary', f), queryFn: () => reportService.summary(f) });
export const useReportFaultFrequency = (f: ReportFilters) =>
  useQuery({ queryKey: qk.reports.report('fault-frequency', f), queryFn: () => reportService.faultFrequency(f) });
export const useReportMaintenance = (f: ReportFilters) =>
  useQuery({ queryKey: qk.reports.report('maintenance', f), queryFn: () => reportService.maintenance(f) });
export const useReportTransformerHealth = (f: ReportFilters) =>
  useQuery({ queryKey: qk.reports.report('transformer-health', f), queryFn: () => reportService.transformerHealth(f) });
export const useReportIncidentDurations = (f: ReportFilters) =>
  useQuery({ queryKey: qk.reports.report('incident-durations', f), queryFn: () => reportService.incidentDurations(f) });
export const useReportDowntime = (f: ReportFilters) =>
  useQuery({ queryKey: qk.reports.report('downtime', f), queryFn: () => reportService.downtime(f) });

// ---- Settings ----
export const useSettings = (enabled = true) =>
  useQuery({ queryKey: qk.settings, queryFn: settingsService.get, enabled });

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SystemSettingsPatch) => settingsService.update(patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.settings, data);
      qc.invalidateQueries({ queryKey: qk.transformers.all });
      qc.invalidateQueries({ queryKey: qk.dashboard.all });
    },
  });
}

// ---- Users & audit ----
export const useAdminUsers = (p: PageParams & { q?: string; role?: Role }) =>
  useQuery({ queryKey: qk.users.admin(p), queryFn: () => adminService.users(p), placeholderData: keepPreviousData });

export const useAssignableUsers = (role?: Role, enabled = true) =>
  useQuery({ queryKey: qk.users.assignable(role), queryFn: () => userService.assignable(role), enabled, staleTime: 60_000 });

export function useUserActions() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: qk.users.all });
  return {
    create: useMutation({ mutationFn: (body: UserCreateRequest) => adminService.createUser(body), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UserUpdateRequest }) => adminService.updateUser(id, body),
      onSuccess,
    }),
  };
}

export const useAuditLogs = (p: AuditLogParams) =>
  useQuery({ queryKey: qk.audit(p), queryFn: () => adminService.auditLogs(p), placeholderData: keepPreviousData });
