import { api } from './apiClient';
import type {
  MaintenanceCompleteRequest,
  MaintenanceCreateRequest,
  MaintenanceDto,
  MaintenanceListParams,
  MaintenanceUpdateRequest,
  PageResponse,
} from '@/types/api';

export const maintenanceService = {
  list: (p: MaintenanceListParams = {}) => api.get<PageResponse<MaintenanceDto>>('/maintenance', p),
  get: (id: string) => api.get<MaintenanceDto>(`/maintenance/${id}`),
  create: (body: MaintenanceCreateRequest) => api.post<MaintenanceDto>('/maintenance', body),
  update: (id: string, body: MaintenanceUpdateRequest) => api.patch<MaintenanceDto>(`/maintenance/${id}`, body),
  complete: (id: string, body: MaintenanceCompleteRequest = {}) =>
    api.post<MaintenanceDto>(`/maintenance/${id}/complete`, body),
};
