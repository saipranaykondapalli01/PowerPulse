import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/pages/DashboardPage';
import { authService } from '@/services/authService';
import { dashboardService } from '@/services/dashboardService';
import { transformerService } from '@/services/transformerService';
import { simulationService } from '@/services/simulationService';
import { ApiError } from '@/services/apiClient';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { makeSimStatus, makeSummary, makeTransformer } from '@/test/fixtures';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/dashboardService', () => ({
  dashboardService: { summary: vi.fn(), trends: vi.fn(), healthDistribution: vi.fn(), faultFrequency: vi.fn() },
}));
vi.mock('@/services/transformerService', () => ({
  transformerService: { all: vi.fn(), locations: vi.fn(), list: vi.fn() },
}));
vi.mock('@/services/simulationService', () => ({
  simulationService: { status: vi.fn(), start: vi.fn(), pause: vi.fn(), reset: vi.fn(), runScenario: vi.fn() },
}));

const dash = vi.mocked(dashboardService);

function tile(label: string) {
  const el = document.querySelector(`[data-stat="${label}"]`);
  if (!el) throw new Error(`No stat tile ${label}`);
  return el as HTMLElement;
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    vi.mocked(authService.me).mockResolvedValue(makeUser('OPERATOR'));
    dash.trends.mockResolvedValue([]);
    dash.healthDistribution.mockResolvedValue([]);
    dash.faultFrequency.mockResolvedValue([]);
    vi.mocked(transformerService.all).mockResolvedValue([makeTransformer()]);
    vi.mocked(transformerService.locations).mockResolvedValue(['Riverside', 'Harbour']);
    vi.mocked(simulationService.status).mockResolvedValue(makeSimStatus());
  });

  it('renders KPI values from the summary API (not hardcoded)', async () => {
    dash.summary.mockResolvedValue(makeSummary());
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });

    await screen.findByText('37');
    expect(within(tile('Healthy')).getByText('21')).toBeInTheDocument();
    expect(within(tile('Warning')).getByText('9')).toBeInTheDocument();
    expect(within(tile('Critical')).getByText('4')).toBeInTheDocument();
    expect(within(tile('Offline')).getByText('3')).toBeInTheDocument();
    expect(within(tile('Network health')).getByText('73')).toBeInTheDocument();
    expect(within(tile('Total load')).getByText('4,321')).toBeInTheDocument();
    expect(within(tile('Active alerts')).getByText('17')).toBeInTheDocument();
    expect(within(tile('Active alerts')).getByText('5 critical')).toBeInTheDocument();
    expect(within(tile('Pending maintenance')).getByText('2 overdue')).toBeInTheDocument();
  });

  it('re-renders different numbers for a different response', async () => {
    dash.summary.mockResolvedValue(makeSummary({ totalTransformers: 58, networkHealth: null }));
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    await screen.findByText('58');
    expect(screen.queryByText('37')).not.toBeInTheDocument();
    expect(within(tile('Network health')).getByText('—')).toBeInTheDocument();
  });

  it('passes URL filters to the summary query', async () => {
    dash.summary.mockResolvedValue(makeSummary());
    renderWithProviders(<DashboardPage />, { route: '/dashboard?location=Harbour&status=CRITICAL', path: '/dashboard' });
    await screen.findByText('37');
    expect(dash.summary).toHaveBeenCalledWith({ location: 'Harbour', status: 'CRITICAL' });
  });

  it('shows loading skeletons while the summary is pending', async () => {
    dash.summary.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    const kpis = await screen.findByRole('region', { name: 'Key metrics' });
    expect(kpis.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('37')).not.toBeInTheDocument();
  });

  it('shows an error with Retry that refetches', async () => {
    dash.summary.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'boom')).mockResolvedValue(makeSummary());
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    expect(await screen.findByText('Could not load the network summary')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('37')).toBeInTheDocument());
    expect(dash.summary).toHaveBeenCalledTimes(2);
  });

  it('links KPI tiles to their filtered destinations', async () => {
    dash.summary.mockResolvedValue(makeSummary());
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    await screen.findByText('37');
    expect(tile('Critical')).toHaveAttribute('href', '/transformers?status=CRITICAL');
    expect(tile('Warning')).toHaveAttribute('href', '/transformers?status=WARNING');
    expect(tile('Transformers')).toHaveAttribute('href', '/transformers');
    expect(tile('Active alerts')).toHaveAttribute('href', '/alerts');
    expect(tile('Pending maintenance')).toHaveAttribute('href', '/maintenance');
    // Computed metrics are not links.
    expect(tile('Network health').tagName).not.toBe('A');
    expect(tile('Total load').tagName).not.toBe('A');
  });

  it('shows load as a share of rated capacity and attention copy only when critical > 0', async () => {
    dash.summary.mockResolvedValue(makeSummary({ totalLoadKva: 630, totalCapacityKva: 1000 }));
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    await screen.findByText('37');
    expect(within(tile('Total load')).getByText(/63 % of 1,000 kVA rated capacity/)).toBeInTheDocument();
    expect(within(tile('Critical')).getByText('Require immediate attention')).toBeInTheDocument();
  });

  it('omits the critical attention copy when there are no critical transformers', async () => {
    dash.summary.mockResolvedValue(makeSummary({ critical: 0 }));
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    await screen.findByText('37');
    expect(within(tile('Critical')).queryByText('Require immediate attention')).not.toBeInTheDocument();
  });

  it('lists only transformers needing attention (excludes healthy ones)', async () => {
    dash.summary.mockResolvedValue(makeSummary());
    vi.mocked(transformerService.all).mockResolvedValue([
      makeTransformer({ id: 'h1', code: 'PP-TX-HEALTHY', status: 'HEALTHY', healthScore: 95 }),
      makeTransformer({ id: 'c1', code: 'PP-TX-CRIT', status: 'CRITICAL', healthScore: 30 }),
      makeTransformer({ id: 'w1', code: 'PP-TX-WARN', status: 'WARNING', healthScore: 62 }),
      makeTransformer({ id: 'l1', code: 'PP-TX-LOWHEALTH', status: 'HEALTHY', healthScore: 65 }),
    ]);
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    const panel = (await screen.findByRole('heading', { name: 'Transformers needing attention' })).closest('section')!;
    await within(panel).findByText('PP-TX-CRIT');
    expect(within(panel).getByText('PP-TX-WARN')).toBeInTheDocument();
    expect(within(panel).getByText('PP-TX-LOWHEALTH')).toBeInTheDocument();
    expect(within(panel).queryByText('PP-TX-HEALTHY')).not.toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /view all transformers/i })).toHaveAttribute('href', '/transformers');
  });

  it('shows "All transformers healthy" when nothing needs attention', async () => {
    dash.summary.mockResolvedValue(makeSummary());
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    expect(await screen.findByText('All transformers healthy')).toBeInTheDocument();
  });

  it('lists critical alerts before lower severities', async () => {
    const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    dash.summary.mockResolvedValue(
      makeSummary({
        recentIncidents: [
          { alertId: 'a1', transformerId: 't1', transformerCode: 'PP-TX-LOW', faultType: 'OVERHEATING', severity: 'LOW', status: 'NEW', createdAt: at(1) },
          { alertId: 'a2', transformerId: 't2', transformerCode: 'PP-TX-CRIT', faultType: 'LOW_OIL_LEVEL', severity: 'CRITICAL', status: 'NEW', createdAt: at(30) },
        ],
      }),
    );
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    const list = await screen.findByRole('list', { name: 'Most recent alerts' });
    const codes = within(list).getAllByText(/^PP-TX-/).map((el) => el.textContent);
    expect(codes).toEqual(['PP-TX-CRIT', 'PP-TX-LOW']);
  });

  it('Refresh refetches the dashboard queries', async () => {
    dash.summary.mockResolvedValue(makeSummary());
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    await screen.findByText('37');
    await waitFor(() => expect(dash.trends).toHaveBeenCalledTimes(1));
    const summaryCalls = dash.summary.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(dash.summary.mock.calls.length).toBeGreaterThan(summaryCalls));
    expect(dash.trends.mock.calls.length).toBeGreaterThan(1);
    expect(vi.mocked(transformerService.all).mock.calls.length).toBeGreaterThan(1);
  });

  it('rejects a start time after the end time and keeps the applied range', async () => {
    dash.summary.mockResolvedValue(makeSummary());
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
    await screen.findByText('37');
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-01-01T10:00' } });
    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/[?&]to=/));
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-01-02T10:00' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Start must be before end.');
    expect(screen.getByTestId('location').textContent).not.toMatch(/[?&]from=/);
    expect(dash.summary).not.toHaveBeenCalledWith(expect.objectContaining({ from: expect.anything() }));
  });

  it('counts active filters and resets them all', async () => {
    dash.summary.mockResolvedValue(makeSummary());
    renderWithProviders(<DashboardPage />, { route: '/dashboard?location=Harbour&status=CRITICAL', path: '/dashboard' });
    await screen.findByText('37');
    const bar = screen.getByRole('region', { name: 'Dashboard filters' });
    expect(within(bar).getByText('filters active')).toBeInTheDocument();
    await userEvent.click(within(bar).getByRole('button', { name: /reset filters/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/dashboard$/));
    expect(within(bar).getByRole('button', { name: /reset filters/i })).toBeDisabled();
  });
});
