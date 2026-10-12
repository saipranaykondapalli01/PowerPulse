import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TransformerForm } from '@/components/transformers/TransformerForm';
import { ApiError } from '@/services/apiClient';

async function fillValid(overrides: Partial<Record<string, string>> = {}) {
  const values: Record<string, string> = {
    Code: 'pp-tx-099',
    Name: 'Harbour Road 3',
    Location: 'Harbour',
    Latitude: '12.97',
    Longitude: '77.59',
    'Grid X': '4',
    'Grid Z': '-2',
    'Rated capacity': '500',
    'Primary voltage': '11',
    'Secondary voltage': '415',
    ...overrides,
  };
  for (const [label, v] of Object.entries(values)) {
    const input = screen.getByLabelText(new RegExp(`^${label}`, 'i'));
    await userEvent.clear(input);
    if (v) await userEvent.type(input, v);
  }
}

describe('TransformerForm', () => {
  it('shows Zod validation errors and does not submit', async () => {
    const onSubmit = vi.fn();
    render(<TransformerForm mode="create" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /register transformer/i }));
    expect(await screen.findByText(/3–20 characters/)).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Location is required')).toBeInTheDocument();
    expect(screen.getByText('Rated capacity is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects invalid code characters and non-positive capacity', async () => {
    const onSubmit = vi.fn();
    render(<TransformerForm mode="create" onSubmit={onSubmit} />);
    await fillValid({ Code: 'TX_1!', 'Rated capacity': '0' });
    await userEvent.click(screen.getByRole('button', { name: /register transformer/i }));
    expect(await screen.findByText(/3–20 characters/)).toBeInTheDocument();
    expect(screen.getByText('Rated capacity must be greater than 0')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits normalized values (code upper-cased, numbers parsed)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    render(<TransformerForm mode="create" onSubmit={onSubmit} onSuccess={onSuccess} />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: /register transformer/i }));
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PP-TX-099', ratedCapacityKva: 500, secondaryVoltageV: 415, gridZ: -2 }),
    );
  });

  it('maps server fieldErrors onto the matching inputs', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed', [
          { field: 'ratedCapacityKva', message: 'exceeds supported range' },
          { field: 'name', message: 'name is reserved' },
        ]),
      );
    render(<TransformerForm mode="create" onSubmit={onSubmit} />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: /register transformer/i }));
    expect(await screen.findByText('exceeds supported range')).toBeInTheDocument();
    expect(screen.getByText('name is reserved')).toBeInTheDocument();
    expect(screen.getByLabelText(/^rated capacity/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a 409 duplicate code on the code field', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, 'CONFLICT', 'Transformer code PP-TX-099 already exists'));
    render(<TransformerForm mode="create" onSubmit={onSubmit} />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: /register transformer/i }));
    expect(await screen.findByText('Transformer code PP-TX-099 already exists')).toBeInTheDocument();
    expect(screen.getByLabelText(/^code/i)).toHaveAttribute('aria-invalid', 'true');
  });
});
