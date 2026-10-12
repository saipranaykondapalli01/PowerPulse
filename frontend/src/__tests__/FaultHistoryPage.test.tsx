import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FaultHistoryPage from '@/pages/FaultHistoryPage';
import { authService } from '@/services/authService';
import { faultHistoryService } from '@/services/faultHistoryService';
import { transformerService } from '@/services/transformerService';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { page } from '@/test/fixtures';
import type { FaultIncidentDto } from '@/types/api';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/faultHistoryService', () => ({ faultHistoryService: { list: vi.fn() } }));
vi.mock('@/services/transformerService', () => ({
  transformerService: { all: vi.fn(), locations: vi.fn(), list: vi.fn() },
}));

const incident: FaultIncidentDto = {
  id: 'i1',
  alertId: 'a1',
  transformerId: 't4',
  transformerCode: 'PP-TX-004',
  location: 'Harbour',
  faultType: 'OVERHEATING',
  severity: 'HIGH',
  startedAt: '2026-10-09T10:00:00Z',
  resolvedAt: null,
  durationSeconds: null,
  peakValue: 98,
  threshold: 85,
  unit: '°C',
  readings: [],
  actionsTaken: ['Reduced load'],
  recurrenceCount: 1,
  maintenanceIds: ['m1'],
  resolutionNotes: null,
};

describe('FaultHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    vi.mocked(authService.me).mockResolvedValue(makeUser('OPERATOR'));
    vi.mocked(transformerService.all).mockResolvedValue([]);
    vi.mocked(transformerService.locations).mockResolvedValue(['Harbour']);
    vi.mocked(faultHistoryService.list).mockResolvedValue(page([incident]));
  });

  it('shows ongoing incidents and applies filters', async () => {
    renderWithProviders(<FaultHistoryPage />, { route: '/fault-history?transformerId=t4', path: '/fault-history' });
    expect(await screen.findByText('ongoing')).toBeInTheDocument();
    expect(faultHistoryService.list).toHaveBeenCalledWith({ page: 0, size: 20, sort: 'startedAt,desc', transformerId: 't4' });
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'HIGH');
    await waitFor(() => expect(faultHistoryService.list).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'HIGH', transformerId: 't4' })));
  });

  it('opens the incident drawer from ?focus= with alert and maintenance links', async () => {
    renderWithProviders(<FaultHistoryPage />, { route: '/fault-history?focus=i1', path: '/fault-history' });
    const drawer = await screen.findByRole('dialog', { name: /overheating · PP-TX-004/i });
    expect(within(drawer).getByRole('link', { name: /alert/i })).toHaveAttribute('href', '/alerts?focus=a1');
    expect(within(drawer).getByRole('link', { name: /task/i })).toHaveAttribute('href', '/maintenance?focus=m1');
    expect(within(drawer).getByText('Reduced load')).toBeInTheDocument();
  });
});
