import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from '@/pages/ReportsPage';
import { authService } from '@/services/authService';
import { reportService } from '@/services/reportService';
import { transformerService } from '@/services/transformerService';
import { ApiError } from '@/services/apiClient';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { makeTransformer } from '@/test/fixtures';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/reportService', () => ({
  reportService: {
    summary: vi.fn(),
    faultFrequency: vi.fn(),
    maintenance: vi.fn(),
    transformerHealth: vi.fn(),
    incidentDurations: vi.fn(),
    downtime: vi.fn(),
    exportCsv: vi.fn(),
  },
}));
vi.mock('@/services/transformerService', () => ({
  transformerService: { all: vi.fn(), locations: vi.fn(), list: vi.fn() },
}));

const svc = vi.mocked(reportService);

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    vi.mocked(authService.me).mockResolvedValue(makeUser('OPERATOR'));
    vi.mocked(transformerService.all).mockResolvedValue([makeTransformer({ id: 't4', code: 'PP-TX-004', name: 'Harbour 4' })]);
    vi.mocked(transformerService.locations).mockResolvedValue(['Riverside', 'Harbour']);
    svc.summary.mockResolvedValue({
      from: '2026-09-10T00:00:00Z',
      to: '2026-10-10T00:00:00Z',
      transformers: 37,
      averageHealth: 74,
      incidents: 12,
      resolvedIncidents: 9,
      meanTimeToResolveSeconds: 5400,
      maintenanceCreated: 8,
      maintenanceCompleted: 5,
      highRiskTransformers: 3,
    });
    svc.faultFrequency.mockResolvedValue([]);
    svc.maintenance.mockResolvedValue({
      byStatus: [{ status: 'COMPLETED', count: 5 }],
      byPriority: [{ priority: 'HIGH', count: 3 }],
      completedOnTime: 4,
      completedLate: 1,
      overdueOpen: 2,
      averageCompletionHours: 20.5,
      byTechnician: [{ technicianId: 'u1', technicianName: 'Tara Tech', assigned: 4, completed: 3 }],
    });
    svc.transformerHealth.mockResolvedValue([
      { transformerId: 't4', code: 'PP-TX-004', name: 'Harbour 4', location: 'Harbour', healthScore: 41, status: 'CRITICAL', activeAlerts: 2, incidentsInRange: 3, highRisk: true, lastMaintenanceAt: null },
    ]);
    svc.incidentDurations.mockResolvedValue([{ faultType: 'OVERHEATING', count: 4, averageSeconds: 3600, maxSeconds: 7200 }]);
    svc.downtime.mockResolvedValue([]);
  });

  it('defaults to the last 30 days and renders report data', async () => {
    renderWithProviders(<ReportsPage />, { route: '/reports', path: '/reports' });
    expect(await screen.findByText('1 h 30 min')).toBeInTheDocument();
    const filters = svc.summary.mock.calls[0][0]!;
    const days = (Date.now() - new Date(filters.from!).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(await screen.findByText('High risk')).toBeInTheDocument();
    expect(screen.getByText('Tara Tech')).toBeInTheDocument();
  });

  it('exports CSV by type with the current filters', async () => {
    svc.exportCsv.mockResolvedValue(undefined);
    renderWithProviders(<ReportsPage />, { route: '/reports?location=Harbour', path: '/reports' });
    await userEvent.click(await screen.findByRole('button', { name: 'Maintenance' }));
    await waitFor(() => expect(svc.exportCsv).toHaveBeenCalledWith('maintenance', expect.objectContaining({ location: 'Harbour' })));
  });

  it('requires a transformer for the readings export', async () => {
    svc.exportCsv.mockResolvedValue(undefined);
    renderWithProviders(<ReportsPage />, { route: '/reports', path: '/reports' });
    await userEvent.click(await screen.findByRole('button', { name: 'Readings' }));
    expect(await screen.findByText('Choose a transformer to export its readings')).toBeInTheDocument();
    expect(svc.exportCsv).not.toHaveBeenCalled();
    await screen.findByRole('option', { name: /PP-TX-004/ });
    await userEvent.selectOptions(screen.getByLabelText('Readings for transformer'), 't4');
    await userEvent.click(screen.getByRole('button', { name: 'Readings' }));
    await waitFor(() => expect(svc.exportCsv).toHaveBeenCalledWith('readings', expect.objectContaining({ transformerId: 't4' })));
  });

  it('shows an error toast when an export fails', async () => {
    svc.exportCsv.mockRejectedValue(new ApiError(400, 'BAD_REQUEST', 'Range too large'));
    renderWithProviders(<ReportsPage />, { route: '/reports', path: '/reports' });
    await userEvent.click(await screen.findByRole('button', { name: 'Fault history' }));
    expect(await screen.findByText('Range too large')).toBeInTheDocument();
  });
});
