import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsPage from '@/pages/NotificationsPage';
import { authService } from '@/services/authService';
import { notificationService } from '@/services/notificationService';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { page } from '@/test/fixtures';
import { makeNotification } from '@/test/workflowFixtures';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/notificationService', () => ({
  notificationService: { list: vi.fn(), unreadCount: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));

const svc = vi.mocked(notificationService);

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    vi.mocked(authService.me).mockResolvedValue(makeUser('OPERATOR'));
    svc.unreadCount.mockResolvedValue({ count: 1 });
    svc.list.mockResolvedValue(
      page([
        makeNotification(),
        makeNotification({ id: 'n2', title: 'Task assigned', type: 'MAINTENANCE_ASSIGNED', relatedType: 'MAINTENANCE', relatedId: 'm9', read: true }),
      ]),
    );
  });

  it('marks unread items with a text label, not only color', async () => {
    renderWithProviders(<NotificationsPage />, { route: '/notifications', path: '/notifications' });
    await screen.findByText('Critical alert on PP-TX-004');
    expect(screen.getAllByText('Unread', { selector: 'span' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Unread: Critical alert on PP-TX-004/ })).toBeInTheDocument();
  });

  it('labels each notification type in text with unread dot + "Unread" text and an unread total', async () => {
    svc.unreadCount.mockResolvedValue({ count: 2 });
    svc.list.mockResolvedValue(
      page([
        makeNotification(),
        makeNotification({ id: 'n3', title: 'Task overdue', type: 'MAINTENANCE_OVERDUE', relatedType: 'MAINTENANCE', relatedId: 'm3' }),
        makeNotification({ id: 'n4', title: 'PP-TX-009 offline', type: 'TRANSFORMER_OFFLINE', relatedType: 'TRANSFORMER', relatedId: 't9', read: true }),
        makeNotification({ id: 'n5', title: 'Incident closed', type: 'INCIDENT_RESOLVED', relatedType: 'INCIDENT', relatedId: 'i5', read: true }),
      ]),
    );
    renderWithProviders(<NotificationsPage />, { route: '/notifications', path: '/notifications' });
    await screen.findByText('Critical alert on PP-TX-004');
    for (const label of ['Critical alert', 'Maintenance overdue', 'Transformer offline', 'Incident resolved']) {
      expect(screen.getByText(label, { selector: 'span' })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Unread', { selector: 'span' })).toHaveLength(2);
    expect(await screen.findByText('2 unread')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Today' })).toBeInTheDocument();
    // Read items have no mark-as-read control.
    expect(screen.queryByRole('button', { name: 'Mark "PP-TX-009 offline" as read' })).not.toBeInTheDocument();
  });

  it('disables "Mark all read" when nothing is unread', async () => {
    svc.unreadCount.mockResolvedValue({ count: 0 });
    renderWithProviders(<NotificationsPage />, { route: '/notifications', path: '/notifications' });
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark all read/i })).toBeDisabled();
  });

  it('marks all as read', async () => {
    svc.markAllRead.mockResolvedValue(undefined);
    renderWithProviders(<NotificationsPage />, { route: '/notifications', path: '/notifications' });
    await screen.findByText('Critical alert on PP-TX-004');
    await userEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    await waitFor(() => expect(svc.markAllRead).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('All notifications marked as read')).toBeInTheDocument();
  });

  it('marks one as read', async () => {
    svc.markRead.mockResolvedValue(makeNotification({ read: true }));
    renderWithProviders(<NotificationsPage />, { route: '/notifications', path: '/notifications' });
    await userEvent.click(await screen.findByRole('button', { name: 'Mark "Critical alert on PP-TX-004" as read' }));
    await waitFor(() => expect(svc.markRead).toHaveBeenCalledWith('n1'));
  });

  it('navigates to the related resource and marks it read on click', async () => {
    svc.markRead.mockResolvedValue(makeNotification({ read: true }));
    renderWithProviders(<NotificationsPage />, { route: '/notifications', path: '/notifications' });
    await userEvent.click(await screen.findByRole('button', { name: /^Unread: Critical alert/ }));
    await waitFor(() => expect(svc.markRead).toHaveBeenCalledWith('n1'));
    expect(screen.getByTestId('location')).toHaveTextContent('/alerts?focus=a1');
  });

  it('filters unread and by type', async () => {
    renderWithProviders(<NotificationsPage />, { route: '/notifications', path: '/notifications' });
    await screen.findByText('Critical alert on PP-TX-004');
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'unread');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'NEW_CRITICAL_ALERT');
    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith({ page: 0, size: 20, read: false, type: 'NEW_CRITICAL_ALERT' }));
  });
});
