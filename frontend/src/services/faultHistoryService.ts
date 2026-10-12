import { api } from './apiClient';
import type { FaultHistoryParams, FaultIncidentDto, PageResponse } from '@/types/api';

export const faultHistoryService = {
  list: (p: FaultHistoryParams = {}) => api.get<PageResponse<FaultIncidentDto>>('/fault-history', p),
};
