import { api } from './apiClient';
import type { NotificationDto, NotificationListParams, PageResponse, UnreadCount } from '@/types/api';

export const notificationService = {
  list: (p: NotificationListParams = {}) => api.get<PageResponse<NotificationDto>>('/notifications', p),
  unreadCount: () => api.get<UnreadCount>('/notifications/unread-count'),
  markRead: (id: string) => api.patch<NotificationDto>(`/notifications/${id}/read`),
  markAllRead: () => api.post<void>('/notifications/read-all'),
};
