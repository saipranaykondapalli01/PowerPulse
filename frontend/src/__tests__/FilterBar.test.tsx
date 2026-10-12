import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from '@/components/ui/FilterBar';
import { RANGE_ORDER_ERROR, validateRange } from '@/components/dashboard/TimeRangeFilter';

describe('FilterBar', () => {
  it('disables Reset and shows no count when nothing is filtered', () => {
    const onReset = vi.fn();
    render(
      <FilterBar activeCount={0} onReset={onReset} label="Test filters">
        <label>
          Name <input />
        </label>
      </FilterBar>,
    );
    expect(screen.getByRole('region', { name: 'Test filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset filters/i })).toBeDisabled();
    expect(screen.getByText('No filters applied')).toBeInTheDocument();
  });

  it('shows the active count as text and calls onReset', async () => {
    const onReset = vi.fn();
    render(
      <FilterBar activeCount={2} onReset={onReset}>
        <span>controls</span>
      </FilterBar>,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('filters active')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reset filters/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('uses singular copy for one filter', () => {
    render(
      <FilterBar activeCount={1} onReset={() => {}}>
        <span>controls</span>
      </FilterBar>,
    );
    expect(screen.getByText('filter active')).toBeInTheDocument();
  });
});

describe('validateRange', () => {
  it('accepts open and ordered ranges', () => {
    expect(validateRange({})).toBeNull();
    expect(validateRange({ from: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(validateRange({ from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' })).toBeNull();
  });

  it('rejects inverted or zero-length ranges', () => {
    expect(validateRange({ from: '2026-01-02T00:00:00Z', to: '2026-01-01T00:00:00Z' })).toBe(RANGE_ORDER_ERROR);
    expect(validateRange({ from: '2026-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' })).toBe(RANGE_ORDER_ERROR);
  });
});
