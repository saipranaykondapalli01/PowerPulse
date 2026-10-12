import { api, request } from './apiClient';
import type { LoginRequest, UserDto } from '@/types/api';

export const authService = {
  csrf: () => api.get<void>('/auth/csrf'),
  login: (body: LoginRequest) => api.post<UserDto>('/auth/login', body),
  logout: () => api.post<void>('/auth/logout'),
  /** Returns null when not authenticated (does not trigger the global 401 redirect). */
  me: async (): Promise<UserDto | null> => {
    try {
      return await request<UserDto>('/auth/me', { silent401: true });
    } catch (e) {
      if ((e as { status?: number }).status === 401) return null;
      throw e;
    }
  },
};
