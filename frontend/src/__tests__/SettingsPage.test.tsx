import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/pages/SettingsPage';
import { authService } from '@/services/authService';
import { settingsService } from '@/services/settingsService';
import { ApiError } from '@/services/apiClient';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { makeSettings } from '@/test/workflowFixtures';
import type { Role } from '@/types/api';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/settingsService', () => ({
  settingsService: { get: vi.fn(), update: vi.fn() },
}));

const svc = vi.mocked(settingsService);

async function setup(role: Role) {
  vi.mocked(authService.me).mockResolvedValue(makeUser(role));
  renderWithProviders(<SettingsPage />, { route: '/settings', path: '/settings' });
  await screen.findByText('Configurable demo defaults — not universal electrical safety limits.');
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    svc.get.mockResolvedValue(makeSettings());
  });

  it('blocks submit when health weights do not add up to 100', async () => {
    await setup('ADMIN');
    const temp = screen.getByLabelText('Temperature');
    await userEvent.clear(temp);
    await userEvent.type(temp, '35');
    expect(screen.getByText(/Total 105 \/ 100/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(await screen.findByText('Health weights must add up to 100 (currently 105)')).toBeInTheDocument();
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('validates threshold ordering by direction', async () => {
    await setup('ADMIN');
    const oilWarn = screen.getByLabelText('Oil level warn');
    await userEvent.clear(oilWarn);
    await userEvent.type(oilWarn, '90');
    await userEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(await screen.findByText('Warn must be below good')).toBeInTheDocument();
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('saves valid changes and maps server field errors onto inputs', async () => {
    svc.update.mockRejectedValueOnce(
      new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed', [{ field: 'thresholds.temperatureC.warn', message: 'Server says no' }]),
    );
    await setup('ADMIN');
    const days = screen.getByLabelText('Upcoming inspection window');
    await userEvent.clear(days);
    await userEvent.type(days, '7');
    await userEvent.click(screen.getByRole('button', { name: /save settings/i }));
    await waitFor(() =>
      expect(svc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.objectContaining({ upcomingInspectionDays: 7 }),
          locations: ['Riverside', 'Harbour'],
        }),
      ),
    );
    expect(await screen.findByText('Server says no')).toBeInTheDocument();
    expect(screen.getByLabelText('Oil temperature warn')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is read-only for engineers', async () => {
    await setup('ENGINEER');
    expect(screen.getByText(/only administrators can change system settings/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Temperature')).toBeDisabled();
  });

  it('keeps every grouped section read-only for engineers', async () => {
    await setup('ENGINEER');
    for (const name of ['Monitoring thresholds', 'Sensor & recovery', 'Health score weights', 'Notifications', 'Locations', 'Simulation']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Oil temperature warn')).toBeDisabled();
    expect(screen.getByLabelText('Sensor timeout')).toBeDisabled();
    expect(screen.getByLabelText('Upcoming inspection window')).toBeDisabled();
    expect(screen.getByLabelText('Location 1')).toBeDisabled();
    expect(screen.getByLabelText('Simulator enabled')).toBeDisabled();
    expect(screen.getByText('Read-only', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /discard changes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^add$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove location/i })).not.toBeInTheDocument();
    expect(svc.update).not.toHaveBeenCalled();
  });
});
