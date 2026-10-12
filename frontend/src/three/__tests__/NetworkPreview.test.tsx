import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { NetworkPreviewNode } from '@/types/api';

vi.mock('@/three/webgl', () => ({
  useRenderCapabilities: () => ({ webgl: false, lowEnd: false, reducedMotion: true, quality: 'high' }),
}));

import NetworkPreview from '../NetworkPreview';

const nodes: NetworkPreviewNode[] = [
  {
    id: 'p1',
    code: 'PP-01',
    name: 'Preview one',
    location: 'Demo',
    gridX: 0,
    gridZ: 0,
    connectedTo: ['p2'],
    status: 'HEALTHY',
    healthScore: 95,
    loadPct: 55,
    temperatureC: 50,
    oilLevelPct: 90,
    voltageV: 415,
    currentA: 200,
    ratedCapacityKva: 400,
    activeFaultCount: 0,
    simulated: true,
  },
  {
    id: 'p2',
    code: 'PP-02',
    name: 'Preview two',
    location: 'Demo',
    gridX: 6,
    gridZ: 0,
    connectedTo: ['p1'],
    status: 'WARNING',
    healthScore: 66,
    loadPct: 92,
    temperatureC: 80,
    oilLevelPct: 70,
    voltageV: 410,
    currentA: 380,
    ratedCapacityKva: 400,
    activeFaultCount: 1,
    simulated: true,
  },
];

describe('NetworkPreview (no WebGL)', () => {
  it('falls back to the 2D map and reports the clicked preview node', () => {
    const onSelect = vi.fn();
    render(<NetworkPreview nodes={nodes} height="300px" onSelect={onSelect} />);
    expect(screen.getByRole('figure', { name: /2 simulated transformers/ })).toHaveStyle({ height: '300px' });
    fireEvent.click(screen.getByRole('button', { name: /^PP-02, Warning/ }));
    expect(onSelect).toHaveBeenCalledWith(nodes[1]);
  });

  it('is purely decorative when interactive=false', () => {
    render(<NetworkPreview nodes={nodes} interactive={false} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('PP-01')).toBeInTheDocument();
  });
});
