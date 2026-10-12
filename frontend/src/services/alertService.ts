import { api } from './apiClient';
import type { AlertDto, AlertListParams, AlertUpdateRequest, PageResponse } from '@/types/api';

export const alertService = {
  list: (p: AlertListParams = {}) => api.get<PageResponse<AlertDto>>('/alerts', p),
  get: (id: string) => api.get<AlertDto>(`/alerts/${id}`),
  update: (id: string, body: AlertUpdateRequest) => api.patch<AlertDto>(`/alerts/${id}`, body),
  acknowledge: (id: string) => api.post<AlertDto>(`/alerts/${id}/acknowledge`),
  assign: (id: string, userId: string) => api.post<AlertDto>(`/alerts/${id}/assign`, { userId }),
  resolve: (id: string, resolutionNotes: string) => api.post<AlertDto>(`/alerts/${id}/resolve`, { resolutionNotes }),
};
