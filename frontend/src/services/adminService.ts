import { api } from './apiClient';
import type {
  AuditLogDto,
  AuditLogParams,
  PageParams,
  PageResponse,
  Role,
  UserCreateRequest,
  UserDto,
  UserSummary,
  UserUpdateRequest,
} from '@/types/api';

export const adminService = {
  users: (p: PageParams & { q?: string; role?: Role } = {}) => api.get<PageResponse<UserDto>>('/admin/users', p),
  createUser: (body: UserCreateRequest) => api.post<UserDto>('/admin/users', body),
  updateUser: (id: string, body: UserUpdateRequest) => api.patch<UserDto>(`/admin/users/${id}`, body),
  auditLogs: (p: AuditLogParams = {}) => api.get<PageResponse<AuditLogDto>>('/admin/audit-logs', p),
};

export const userService = {
  assignable: (role?: Role) => api.get<UserSummary[]>('/users/assignable', { role }),
};
