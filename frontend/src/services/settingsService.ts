import { api } from './apiClient';
import type { SystemSettingsDto, SystemSettingsPatch } from '@/types/api';

export const settingsService = {
  get: () => api.get<SystemSettingsDto>('/settings'),
  update: (patch: SystemSettingsPatch) => api.patch<SystemSettingsDto>('/settings', patch),
};
