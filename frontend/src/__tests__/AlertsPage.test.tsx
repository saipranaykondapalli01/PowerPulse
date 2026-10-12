import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AlertsPage from '@/pages/AlertsPage';
import { authService } from '@/services/authService';
import { alertService } from '@/services/alertService';
import { transformerService } from '@/services/transformerService';
import { userService } from '@/services/adminService';
import { maintenanceService } from '@/services/maintenanceService';
import { ApiError } from '@/services/apiClient';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { makeTransformer, page } from '@/test/fixtures';
import { makeAlert, makeTask } from '@/test/workflowFixtures';
import type { Role } from '@/types/api';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/alertService', () => ({
  alertService: { list: vi.fn(), get: vi.fn(), update: vi.fn(), acknowledge: vi.fn(), assign: vi.fn(), resolve: vi.fn() },
}));
vi.mock('@/services/transformerService', () => ({
  transformerService: { all: vi.fn(), locations: vi.fn(), list: vi.fn() },
}));
vi.mock('@/services/adminService', () => ({
  userService: { assignable: vi.fn() },
  adminService: {},
}));
vi.mock('@/services/maintenanceService', () => ({
  maintenanceService: { create: vi.fn(), list: vi.fn(), get: vi.fn(), update: vi.fn(), complete: vi.fn() },
}));

const svc = vi.mocked(alertService);

function setup(role: Role = 'ENGINEER', route = '/alerts') {
  vi.mocked(authService.me).mockResolvedValue(makeUser(role));
  return renderWithProviders(<AlertsPage />, { route, path: '/alerts' });
}

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    vi.mocked(transformerService.all).mockResolvedValue([makeTransformer({ id: 't4', code: 'PP-TX-004', name: 'Harbour 4' })]);
    vi.mocked(transformerService.locations).mockResolvedValue(['Riverside', 'Harbour']);
    vi.mocked(userService.assignable).mockResolvedValue([{ id: 'u-op', name: 'Olivia Operator', role: 'OPERATOR', region: null }]);
    svc.list.mockResolvedValue(page([makeAlert()]));
    svc.get.mockResolvedValue(makeAlert());
  });

  it('sends default params, then filters from the UI and URL to alertService.list', async () => {
    setup('OPERATOR', '/alerts?transformerId=t4');
    await screen.findByText('PP-TX-004', { selector: 'a' });
    expect(svc.list).toHaveBeenCalledWith({ page: 0, size: 20, sort: 'createdAt,desc', active: true, transformerId: 't4' });

    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'CRITICAL');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ACKNOWLEDGED');
    await userEvent.selectOptions(screen.getByLabelText('Fault type'), 'OVERHEATING');
    await userEvent.selectOptions(screen.getByLabelText('Location'), 'Harbour');
    await userEvent.click(screen.getByLabelText('Active only'));
    await userEvent.type(screen.getByLabelText('Search'), 'fan');

    await waitFor(() =>
      expect(svc.list).toHaveBeenLastCalledWith({
        page: 0,
        size: 20,
        sort: 'createdAt,desc',
        transformerId: 't4',
        severity: 'CRITICAL',
        status: 'ACKNOWLEDGED',
        faultType: 'OVERHEATING',
        location: 'Harbour',
        q: 'fan',
      }),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('active=all');
  });

  it('reads the header counts from size=1 alert queries (totalElements), not the visible page', async () => {
    svc.list.mockImplementation(async (p = {}) => {
      if (p.size === 1) {
        const total = p.severity === 'CRITICAL' ? 3 : p.status === 'NEW' ? 7 : p.status === 'IN_PROGRESS' ? 2 : 41;
        return page([], { size: 1, totalElements: total, totalPages: total });
      }
      return page([makeAlert()]);
    });
    setup();
    const counts = await screen.findByRole('region', { name: 'Alert counts' });
    expect(await within(counts).findByRole('button', { name: /^Active alerts: 41/ })).toBeInTheDocument();
    expect(within(counts).getByRole('button', { name: /^Critical: 3/ })).toBeInTheDocument();
    expect(within(counts).getByRole('button', { name: /^Unacknowledged: 7/ })).toBeInTheDocument();
    expect(within(counts).getByRole('button', { name: /^In progress: 2/ })).toBeInTheDocument();
    expect(svc.list).toHaveBeenCalledWith({ active: true, page: 0, size: 1 });
    expect(svc.list).toHaveBeenCalledWith({ active: true, severity: 'CRITICAL', page: 0, size: 1 });

    await userEvent.click(within(counts).getByRole('button', { name: /^Critical: 3/ }));
    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ size: 20, severity: 'CRITICAL', active: true })));
  });

  it('disables every action while a workflow change is pending and does not toast early', async () => {
    let finish: (v: unknown) => void = () => {};
    svc.acknowledge.mockReturnValue(new Promise((r) => (finish = r)) as never);
    setup('ENGINEER', '/alerts?focus=a1');
    const drawer = await screen.findByRole('dialog', { name: /overheating · PP-TX-004/i });
    const ack = await within(drawer).findByRole('button', { name: 'Acknowledge' });
    await userEvent.click(ack);
    await waitFor(() => expect(ack).toBeDisabled());
    expect(ack).toHaveAttribute('aria-busy', 'true');
    expect(within(drawer).getByRole('button', { name: 'Resolve' })).toBeDisabled();
    expect(within(drawer).getByRole('button', { name: 'Create maintenance' })).toBeDisabled();
    expect(within(drawer).getByRole('button', { name: 'Assign' })).toBeDisabled();
    await userEvent.click(ack);
    expect(svc.acknowledge).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Alert acknowledged')).not.toBeInTheDocument();

    finish(makeAlert({ status: 'ACKNOWLEDGED' }));
    expect(await screen.findByText('Alert acknowledged')).toBeInTheDocument();
  });

  it('sorts via the table header', async () => {
    setup();
    await screen.findByText('PP-TX-004', { selector: 'a' });
    await userEvent.click(screen.getByRole('button', { name: /severity/i }));
    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'severity,asc' })));
  });

  it('shows the recovered indicator', async () => {
    svc.list.mockResolvedValue(page([makeAlert({ status: 'ACKNOWLEDGED', recovered: true })]));
    setup();
    expect(await screen.findByText('Readings normal — awaiting resolution')).toBeInTheDocument();
  });

  it('opens the drawer from ?focus= and acknowledges', async () => {
    svc.acknowledge.mockResolvedValue(makeAlert({ status: 'ACKNOWLEDGED' }));
    setup('OPERATOR', '/alerts?focus=a1');
    const drawer = await screen.findByRole('dialog', { name: /overheating · PP-TX-004/i });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(svc.acknowledge).toHaveBeenCalledWith('a1'));
    expect(await screen.findByText('Alert acknowledged')).toBeInTheDocument();
    // Operators cannot resolve or create maintenance.
    expect(within(drawer).queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Create maintenance' })).not.toBeInTheDocument();
  });

  it('opens the drawer on row click', async () => {
    setup();
    await userEvent.click(await screen.findByRole('row', { name: /open overheating alert on PP-TX-004/i }));
    expect(await screen.findByRole('dialog', { name: /overheating · PP-TX-004/i })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('focus=a1');
  });

  it('hides all workflow actions from technicians', async () => {
    setup('TECHNICIAN', '/alerts?focus=a1');
    const drawer = await screen.findByRole('dialog', { name: /overheating · PP-TX-004/i });
    await within(drawer).findByText('Event timeline');
    expect(within(drawer).queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument();
    expect(within(drawer).queryByLabelText('Assign to')).not.toBeInTheDocument();
  });

  it('shows the server message when acknowledge conflicts (409)', async () => {
    svc.acknowledge.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Alert is already acknowledged'));
    setup('ENGINEER', '/alerts?focus=a1');
    const drawer = await screen.findByRole('dialog', { name: /overheating/i });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Acknowledge' }));
    expect(await screen.findByText('Alert is already acknowledged')).toBeInTheDocument();
  });

  it('requires resolution notes of at least 5 characters', async () => {
    svc.resolve.mockResolvedValue(makeAlert({ status: 'RESOLVED' }));
    setup('ENGINEER', '/alerts?focus=a1');
    const drawer = await screen.findByRole('dialog', { name: /overheating/i });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Resolve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Resolve alert' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve alert' }));
    expect(await within(dialog).findByText('Resolution notes must be at least 5 characters')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/resolution notes/i), 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve alert' }));
    expect(svc.resolve).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByLabelText(/resolution notes/i), ' — replaced fan relay');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve alert' }));
    await waitFor(() => expect(svc.resolve).toHaveBeenCalledWith('a1', 'abc — replaced fan relay'));
  });

  it('creates maintenance from an alert with alertId, transformer and defaults prefilled', async () => {
    vi.mocked(maintenanceService.create).mockResolvedValue(makeTask({ alertId: 'a1' }));
    setup('ENGINEER', '/alerts?focus=a1');
    const drawer = await screen.findByRole('dialog', { name: /overheating/i });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Create maintenance' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create maintenance task' });
    expect(within(dialog).getByLabelText(/title/i)).toHaveValue('Investigate OVERHEATING on PP-TX-004');
    expect(within(dialog).getByLabelText(/priority/i)).toHaveValue('URGENT');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }));
    await waitFor(() =>
      expect(maintenanceService.create).toHaveBeenCalledWith(
        expect.objectContaining({ alertId: 'a1', transformerId: 't4', title: 'Investigate OVERHEATING on PP-TX-004', priority: 'URGENT' }),
      ),
    );
  });
});
