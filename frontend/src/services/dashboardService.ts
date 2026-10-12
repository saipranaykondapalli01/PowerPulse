import { api } from './apiClient';
import type { DashboardFilters, DashboardSummary, FaultFrequency, HealthBucket, TrendPoint } from '@/types/api';

export const dashboardService = {
  summary: (f: DashboardFilters = {}) => api.get<DashboardSummary>('/dashboard/summary', f),
  trends: (f: DashboardFilters & { bucket?: 'HOUR' | 'DAY' } = {}) => api.get<TrendPoint[]>('/dashboard/trends', f),
  healthDistribution: (f: Pick<DashboardFilters, 'location'> = {}) =>
    api.get<HealthBucket[]>('/dashboard/health-distribution', f),
  faultFrequency: (f: DashboardFilters = {}) => api.get<FaultFrequency[]>('/dashboard/fault-frequency', f),
};
