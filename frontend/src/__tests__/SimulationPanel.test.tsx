import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationPanel } from '@/components/simulation/SimulationPanel';
import { authService } from '@/services/authService';
import { simulationService } from '@/services/simulationService';
import { transformerService } from '@/services/transformerService';
import { makeUser, renderWithProviders } from '@/test/renderWithProviders';
import { makeSimStatus, makeTransformer } from '@/test/fixtures';

vi.mock('@/services/authService', () => ({
  authService: { me: vi.fn(), csrf: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/services/simulationService', () => ({
  simulationService: { status: vi.fn(), start: vi.fn(), pause: vi.fn(), reset: vi.fn(), runScenario: vi.fn() },
}));
vi.mock('@/services/transformerService', () => ({
  transformerService: { all: vi.fn() },
}));

const sim = vi.mocked(simulationService);

describe('SimulationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.csrf).mockResolvedValue(undefined);
    sim.status.mockResolvedValue(
      makeSimStatus({
        scenarios: [{ transformerId: 't9', transformerCode: 'PP-TX-009', name: 'overloading', startedAt: new Date().toISOString(), step: 3 }],
      }),
    );
    vi.mocked(transformerService.all).mockResolvedValue([
      makeTransformer(),
      makeTransformer({ id: 't2', code: 'PP-TX-002', name: 'Harbour 2' }),
    ]);
  });

  it('runs the selected scenario on the selected transformer', async () => {
    vi.mocked(authService.me).mockResolvedValue(makeUser('ENGINEER'));
    sim.runScenario.mockResolvedValue(makeSimStatus());
    renderWithProviders(<SimulationPanel />);

    expect(await screen.findByText('PP-TX-009')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Scenario'), 'low-oil');
    await waitFor(() => expect(screen.getByRole('option', { name: /PP-TX-002/ })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Transformer'), 't2');
    await userEvent.click(screen.getByRole('button', { name: /run scenario/i }));

    await waitFor(() => expect(sim.runScenario).toHaveBeenCalledWith('low-oil', 't2'));
    expect(await screen.findByText('Scenario started')).toBeInTheDocument();
  });

  it('requires both selections before running', async () => {
    vi.mocked(authService.me).mockResolvedValue(makeUser('ADMIN'));
    renderWithProviders(<SimulationPanel />);
    await userEvent.click(await screen.findByRole('button', { name: /run scenario/i }));
    expect(screen.getByText('Choose a scenario and a transformer.')).toBeInTheDocument();
    expect(sim.runScenario).not.toHaveBeenCalled();
  });

  it('pauses a running simulation', async () => {
    vi.mocked(authService.me).mockResolvedValue(makeUser('ADMIN'));
    sim.pause.mockResolvedValue(makeSimStatus({ running: false }));
    renderWithProviders(<SimulationPanel />);
    await userEvent.click(await screen.findByRole('button', { name: /pause/i }));
    await waitFor(() => expect(sim.pause).toHaveBeenCalled());
  });

  it('is read-only for operators', async () => {
    vi.mocked(authService.me).mockResolvedValue(makeUser('OPERATOR'));
    renderWithProviders(<SimulationPanel />);
    expect(await screen.findByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run scenario/i })).not.toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });
});
