import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MaintenancePage from '@/pages/MaintenancePage';
import { authService } from '@/services/authService';
import { maintenanceService } from '@/services/maintenanceService';
import { transformerService } from '@/services/transformerService';
import { userService } from '@/services/adminService';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { makeTransformer, page } from '@/test/fixtures';
import { makeTask } from '@/test/workflowFixtures';
import type { MaintenanceDto, Role } from '@/types/api';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/maintenanceService', () => ({
  maintenanceService: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), complete: vi.fn() },
}));
vi.mock('@/services/transformerService', () => ({
  transformerService: { all: vi.fn(), locations: vi.fn(), list: vi.fn() },
}));
vi.mock('@/services/adminService', () => ({
  userService: { assignable: vi.fn() },
  adminService: {},
}));

const svc = vi.mocked(maintenanceService);

function setup(role: Role, task: MaintenanceDto, route = '/maintenance') {
  vi.mocked(authService.me).mockResolvedValue(makeUser(role));
  svc.list.mockResolvedValue(page([task]));
  svc.get.mockResolvedValue(task);
  return renderWithProviders(<MaintenancePage />, { route, path: '/maintenance' });
}

describe('MaintenancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    vi.mocked(transformerService.all).mockResolvedValue([makeTransformer({ id: 't4', code: 'PP-TX-004' })]);
    vi.mocked(transformerService.locations).mockResolvedValue([]);
    vi.mocked(userService.assignable).mockResolvedValue([{ id: 'u-technician', name: 'Test TECHNICIAN', role: 'TECHNICIAN', region: null }]);
  });

  it('shows "My tasks" without "New task" or technician filter for technicians', async () => {
    setup('TECHNICIAN', makeTask());
    expect(await screen.findByRole('heading', { level: 1, name: 'My tasks' })).toBeInTheDocument();
    await screen.findByText('Inspect cooling fans');
    expect(screen.queryByRole('button', { name: /new task/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Technician')).not.toBeInTheDocument();
  });

  it('lets the assigned technician start their own task', async () => {
    svc.update.mockResolvedValue(makeTask({ status: 'IN_PROGRESS' }));
    setup('TECHNICIAN', makeTask(), '/maintenance?focus=m1');
    const drawer = await screen.findByRole('dialog', { name: 'Inspect cooling fans' });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Start work' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('m1', { status: 'IN_PROGRESS' }));
    // Technicians cannot manage (assign / cancel).
    expect(within(drawer).queryByRole('button', { name: 'Cancel task' })).not.toBeInTheDocument();
  });

  it('lets the assigned technician complete an in-progress task', async () => {
    svc.complete.mockResolvedValue(makeTask({ status: 'COMPLETED' }));
    setup('TECHNICIAN', makeTask({ status: 'IN_PROGRESS' }), '/maintenance?focus=m1');
    const drawer = await screen.findByRole('dialog', { name: 'Inspect cooling fans' });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Complete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Complete task' });
    await userEvent.type(within(dialog).getByLabelText(/inspection findings/i), 'Fan bearing worn');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark complete' }));
    await waitFor(() => expect(svc.complete).toHaveBeenCalledWith('m1', { inspectionFindings: 'Fan bearing worn' }));
  });

  it('does not offer progress actions to a technician who is not assigned', async () => {
    setup('TECHNICIAN', makeTask({ assignedTechnicianId: 'someone-else' }), '/maintenance?focus=m1');
    const drawer = await screen.findByRole('dialog', { name: 'Inspect cooling fans' });
    await within(drawer).findByText('History');
    expect(within(drawer).queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
    expect(within(drawer).queryByLabelText('Add work note')).not.toBeInTheDocument();
  });

  it('requires a reason to cancel a task', async () => {
    svc.update.mockResolvedValue(makeTask({ status: 'CANCELLED' }));
    setup('ENGINEER', makeTask(), '/maintenance?focus=m1');
    expect(await screen.findByRole('button', { name: /new task/i })).toBeInTheDocument();
    const drawer = await screen.findByRole('dialog', { name: 'Inspect cooling fans' });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Cancel task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel task' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel task' }));
    expect(await within(dialog).findByText('A cancellation reason is required')).toBeInTheDocument();
    expect(svc.update).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/reason/i), 'Duplicate of task 12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel task' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('m1', { status: 'CANCELLED', cancelReason: 'Duplicate of task 12' }));
  });

  it('applies tab and filters to maintenanceService.list', async () => {
    setup('ENGINEER', makeTask());
    await screen.findByText('Inspect cooling fans');
    expect(svc.list).toHaveBeenCalledWith({ page: 0, size: 20, sort: 'dueDate,asc' });
    await userEvent.click(screen.getByRole('tab', { name: 'Overdue' }));
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'URGENT');
    await userEvent.selectOptions(await screen.findByLabelText('Technician'), 'u-technician');
    await waitFor(() =>
      expect(svc.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ overdue: true, priority: 'URGENT', technicianId: 'u-technician', page: 0 }),
      ),
    );
  });

  it('shows completed tasks as read-only', async () => {
    setup('ENGINEER', makeTask({ status: 'COMPLETED', completedAt: new Date().toISOString() }), '/maintenance?focus=m1');
    const drawer = await screen.findByRole('dialog', { name: 'Inspect cooling fans' });
    expect(await within(drawer).findByText(/completed and read-only/i)).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Cancel task' })).not.toBeInTheDocument();
    expect(within(drawer).queryByLabelText('Add work note')).not.toBeInTheDocument();
  });
});
