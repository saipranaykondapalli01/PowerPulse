import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordReadingDialog } from '@/components/transformers/RecordReadingDialog';
import { ApiError } from '@/services/apiClient';
import { transformerService } from '@/services/transformerService';
import type { TransformerDetailDto } from '@/types/api';
import { makeTransformer } from '@/test/fixtures';
import { renderWithProviders } from '@/test/renderWithProviders';

vi.mock('@/services/transformerService', () => ({
  transformerService: { recordReading: vi.fn() },
}));

const detail: TransformerDetailDto = {
  ...makeTransformer({ id: 't1', code: 'PP-TX-001', secondaryVoltageV: 415 }),
  healthFactors: [],
  recommendations: [],
  ratedCurrentA: 556,
  sensorTimeoutSeconds: 120,
};

function renderDialog(onClose = vi.fn()) {
  renderWithProviders(<RecordReadingDialog open onClose={onClose} transformer={detail} />, { withAuth: false });
  return onClose;
}

async function fill(values: Record<string, string>) {
  for (const [label, v] of Object.entries(values)) {
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    await userEvent.clear(input);
    await userEvent.type(input, v);
  }
}

const VALID = {
  'Top-oil temperature': '72.5',
  'Oil level': '88',
  '^Voltage': '414',
  '^Current': '420',
  '^Load': '63',
};

describe('RecordReadingDialog', () => {
  beforeEach(() => {
    vi.mocked(transformerService.recordReading).mockReset();
  });

  it('requires every meter value and blocks impossible ones', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: /record reading/i }));
    expect(await screen.findByText('Temperature is required')).toBeInTheDocument();
    expect(screen.getByText('Oil level is required')).toBeInTheDocument();

    await fill({ ...VALID, 'Oil level': '140', '^Voltage': '900' });
    await userEvent.click(screen.getByRole('button', { name: /record reading/i }));
    expect(await screen.findByText('Oil level must be at most 100')).toBeInTheDocument();
    expect(screen.getByText('Voltage must be at most 830')).toBeInTheDocument();
    expect(transformerService.recordReading).not.toHaveBeenCalled();
  });

  it('submits the reading with the simulator hold on by default', async () => {
    vi.mocked(transformerService.recordReading).mockResolvedValue({} as never);
    const onClose = renderDialog();
    await fill(VALID);
    await userEvent.click(screen.getByRole('button', { name: /record reading/i }));

    await waitFor(() => expect(transformerService.recordReading).toHaveBeenCalledTimes(1));
    const [id, body] = vi.mocked(transformerService.recordReading).mock.calls[0];
    expect(id).toBe('t1');
    expect(body).toMatchObject({
      temperatureC: 72.5,
      oilLevelPct: 88,
      voltageV: 414,
      currentA: 420,
      loadPct: 63,
      powerFactor: null,
      holdFromSimulator: true,
    });
    expect(typeof body.recordedAt).toBe('string');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the dialog open and shows the server error when recording fails', async () => {
    vi.mocked(transformerService.recordReading).mockRejectedValue(
      new ApiError(400, 'BAD_REQUEST', 'voltageV is more than twice the rated secondary voltage'),
    );
    const onClose = renderDialog();
    await fill(VALID);
    await userEvent.click(screen.getByLabelText(/hold this transformer/i));
    await userEvent.click(screen.getByRole('button', { name: /record reading/i }));

    expect(await screen.findByText(/more than twice the rated secondary voltage/)).toBeInTheDocument();
    expect(vi.mocked(transformerService.recordReading).mock.calls[0][1].holdFromSimulator).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
