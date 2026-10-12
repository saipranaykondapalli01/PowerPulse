import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FLOW_CAPTION, GridControls, GridLegend, GridStats, TransformerList } from '../GridHud';
import { DEFAULT_FILTER, deriveStats, fromTransformer, statsFromSummary } from '../utils';
import { summary, transformers } from './fixtures';

const nodes = transformers.map(fromTransformer);

function statValue(name: string) {
  const region = screen.getByRole('region', { name: 'Network summary' });
  const dt = within(region).getByText(name, { selector: 'dt' });
  return dt.nextElementSibling?.textContent;
}

describe('GridStats', () => {
  it('shows the dashboard summary numbers', () => {
    render(<GridStats stats={statsFromSummary(summary, nodes)} />);
    expect(statValue('Total')).toBe('42');
    expect(statValue('Healthy')).toBe('30');
    expect(statValue('Warning')).toBe('7');
    expect(statValue('Critical')).toBe('3');
    expect(statValue('Offline')).toBe('2');
    expect(statValue('Net health')).toBe('81');
    expect(statValue('Active faults')).toBe('9');
    expect(statValue('Sim. load')).toBe('50%');
  });

  it('falls back to counts derived from transformer data', () => {
    render(<GridStats stats={deriveStats(nodes)} visibleCount={1} />);
    expect(statValue('Total')).toBe('3');
    expect(statValue('Critical')).toBe('1');
    expect(statValue('Active faults')).toBe('2');
    expect(screen.getByText(/Showing 1 of 3 transformers/)).toBeInTheDocument();
  });
});

describe('GridControls', () => {
  const base = {
    filter: DEFAULT_FILTER,
    locations: ['North Yard', 'South Yard'],
    highlightFaults: false,
    onHighlightFaults: vi.fn(),
    viewMode: 'overview' as const,
    onViewMode: vi.fn(),
    canIndividual: false,
    onResetCamera: vi.fn(),
    renderMode: '3d' as const,
    onRenderMode: vi.fn(),
    webglAvailable: true,
  };

  it('toggles status chips and location filter', () => {
    const onFilterChange = vi.fn();
    render(<GridControls {...base} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Critical/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith({ statuses: ['CRITICAL'], location: '' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'South Yard' } });
    expect(onFilterChange).toHaveBeenLastCalledWith({ statuses: [], location: 'South Yard' });
  });

  it('exposes highlight, reset and 2D toggles', () => {
    render(<GridControls {...base} onFilterChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Highlight faults/ }));
    expect(base.onHighlightFaults).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: /Reset view/ }));
    expect(base.onResetCamera).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Individual/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /2D view/ }));
    expect(base.onRenderMode).toHaveBeenCalledWith('2d');
  });
});

describe('GridLegend', () => {
  it('labels every status with text and carries the flow caption', () => {
    render(<GridLegend />);
    for (const t of ['Healthy', 'Warning', 'Critical', 'Offline']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText(FLOW_CAPTION)).toBeInTheDocument();
  });
});

describe('TransformerList', () => {
  it('lists most urgent first and selects with a button', () => {
    const onSelect = vi.fn();
    render(<TransformerList nodes={nodes} selectedId={null} onSelect={onSelect} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('TX-002');
    fireEvent.click(screen.getByRole('button', { name: /TX-001/ }));
    expect(onSelect).toHaveBeenCalledWith('tx-001');
  });
});
