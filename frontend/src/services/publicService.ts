import { api } from './apiClient';
import type { NetworkPreviewNode } from '@/types/api';

/** Unauthenticated, sanitized network snapshot used by the landing page (all values SIMULATED). */
export const publicService = {
  networkPreview: () => api.get<NetworkPreviewNode[]>('/public/network-preview'),
};
