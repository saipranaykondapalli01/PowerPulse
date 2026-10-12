import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Grid2D } from '../Grid2D';
import { fromTransformer } from '../utils';
import { transformers } from './fixtures';

const nodes = transformers.map(fromTransformer);

describe('Grid2D', () => {
  it('renders every node with code and status text (not color alone)', () => {
    render(<Grid2D nodes={nodes} />);
    expect(screen.getByRole('group', { name: /2D transformer network map/i })).toBeInTheDocument();
    for (const t of transformers) expect(screen.getByText(t.code)).toBeInTheDocument();
    expect(screen.getByText(/HEALTHY · 92/)).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL · 35/)).toBeInTheDocument();
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /TX-002, Critical, health 35, 2 active faults/ })).toBeInTheDocument();
  });

  it('calls onSelect on click and on Enter', () => {
    const onSelect = vi.fn();
    render(<Grid2D nodes={nodes} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /^TX-001/ }));
    expect(onSelect).toHaveBeenCalledWith('tx-001');
    fireEvent.keyDown(screen.getByRole('button', { name: /^TX-003/ }), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('tx-003');
  });

  it('only renders visible nodes', () => {
    render(<Grid2D nodes={nodes} visibleIds={new Set(['tx-001'])} />);
    expect(screen.getByText('TX-001')).toBeInTheDocument();
    expect(screen.queryByText('TX-002')).not.toBeInTheDocument();
  });

  it('marks the selected node as pressed', () => {
    render(<Grid2D nodes={nodes} selectedId="tx-002" />);
    expect(screen.getByRole('button', { name: /^TX-002/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('is non-interactive when interactive=false', () => {
    render(<Grid2D nodes={nodes} interactive={false} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
