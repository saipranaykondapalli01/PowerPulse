import { api, downloadFile } from './apiClient';
import type {
  CsvExportType,
  DowntimeRow,
  FaultFrequency,
  IncidentDurationRow,
  MaintenanceReport,
  ReportFilters,
  ReportSummary,
  TransformerHealthReportRow,
} from '@/types/api';

export const reportService = {
  summary: (f: ReportFilters = {}) => api.get<ReportSummary>('/reports/summary', f),
  faultFrequency: (f: ReportFilters = {}) => api.get<FaultFrequency[]>('/reports/fault-frequency', f),
  maintenance: (f: ReportFilters = {}) => api.get<MaintenanceReport>('/reports/maintenance', f),
  transformerHealth: (f: ReportFilters = {}) =>
    api.get<TransformerHealthReportRow[]>('/reports/transformer-health', f),
  incidentDurations: (f: ReportFilters = {}) => api.get<IncidentDurationRow[]>('/reports/incident-durations', f),
  downtime: (f: ReportFilters = {}) => api.get<DowntimeRow[]>('/reports/downtime', f),
  exportCsv: (type: CsvExportType, f: ReportFilters & { transformerId?: string } = {}) =>
    downloadFile('/reports/export.csv', { type, ...f }, `powerpulse-${type}-${new Date().toISOString().slice(0, 10)}.csv`),
};
