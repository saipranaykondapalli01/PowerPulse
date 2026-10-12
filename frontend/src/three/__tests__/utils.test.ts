import { describe, expect, it } from 'vitest';
import {
  TARGET_SPACING,
  computeLayout,
  dedupeEdges,
  deriveStats,
  edgeHasFlow,
  edgeLoad,
  fromTransformer,
  matchesFilter,
  particleDensity,
  particleSpeed,
  statsFromSummary,
  statusColor,
  statusIcon,
  statusLabel,
  toggleStatus,
} from '../utils';
import { summary, transformers } from './fixtures';

describe('status helpers', () => {
  it('maps every status to a color, icon and text label', () => {
    expect(statusColor('HEALTHY')).toBe('#5CBF78');
    expect(statusColor('WARNING')).toBe('#E8A33E');
    expect(statusColor('CRITICAL')).toBe('#D94A45');
    expect(statusColor('OFFLINE')).toBe('#80837A');
    expect(statusLabel('CRITICAL')).toBe('Critical');
    expect(statusIcon('WARNING')).toBe('TriangleAlert');
    expect(statusIcon('OFFLINE')).toBe('PowerOff');
  });
});

describe('dedupeEdges', () => {
  it('collapses A–B / B–A, drops self-loops and unknown ids', () => {
    const edges = dedupeEdges([
      { id: 'a', connectedTo: ['b', 'c', 'a', 'ghost'] },
      { id: 'b', connectedTo: ['a'] },
      { id: 'c', connectedTo: ['a', 'b'] },
    ]);
    expect(edges.map((e) => e.key).sort()).toEqual(['a|b', 'a|c', 'b|c']);
  });

  it('returns no edges for isolated nodes', () => {
    expect(dedupeEdges([{ id: 'a', connectedTo: [] }])).toEqual([]);
  });
});

describe('flow density', () => {
  it('scales particle count with load and is zero without load', () => {
    expect(particleDensity(null)).toBe(0);
    expect(particleDensity(0)).toBe(0);
    expect(particleDensity(5, 8)).toBe(1);
    expect(particleDensity(50, 8)).toBe(4);
    expect(particleDensity(100, 8)).toBe(8);
    expect(particleDensity(500, 8)).toBe(Math.round(1.2 * 8)); // clamped at 120 %
    expect(particleDensity(100, 4)).toBeLessThan(particleDensity(100, 8));
  });

  it('moves faster under higher load', () => {
    expect(particleSpeed(null)).toBe(0);
    expect(particleSpeed(90)).toBeGreaterThan(particleSpeed(20));
  });

  it('averages endpoint load and stops flow on OFFLINE endpoints', () => {
    expect(edgeLoad({ loadPct: 40 }, { loadPct: 80 })).toBe(60);
    expect(edgeLoad({ loadPct: null }, { loadPct: 80 })).toBe(80);
    expect(edgeLoad({ loadPct: null }, { loadPct: null })).toBeNull();
    expect(edgeHasFlow({ status: 'HEALTHY' }, { status: 'CRITICAL' })).toBe(true);
    expect(edgeHasFlow({ status: 'HEALTHY' }, { status: 'OFFLINE' })).toBe(false);
  });
});

describe('matchesFilter', () => {
  const node = { status: 'WARNING' as const, location: 'North Yard' };
  it('shows everything with the default filter', () => {
    expect(matchesFilter(node, { statuses: [], location: '' })).toBe(true);
  });
  it('filters by status set and location', () => {
    expect(matchesFilter(node, { statuses: ['WARNING', 'CRITICAL'], location: '' })).toBe(true);
    expect(matchesFilter(node, { statuses: ['HEALTHY'], location: '' })).toBe(false);
    expect(matchesFilter(node, { statuses: [], location: 'South Yard' })).toBe(false);
    expect(matchesFilter(node, { statuses: ['WARNING'], location: 'North Yard' })).toBe(true);
  });
  it('toggles statuses in and out', () => {
    expect(toggleStatus([], 'HEALTHY')).toEqual(['HEALTHY']);
    expect(toggleStatus(['HEALTHY', 'OFFLINE'], 'HEALTHY')).toEqual(['OFFLINE']);
  });
});

describe('computeLayout', () => {
  it('centers on the origin and normalizes spacing', () => {
    const layout = computeLayout([
      { id: 'a', gridX: 100, gridZ: 100 },
      { id: 'b', gridX: 102, gridZ: 100 },
      { id: 'c', gridX: 104, gridZ: 100 },
    ]);
    expect(layout.positions.get('b')).toEqual([0, 0]);
    expect(layout.positions.get('a')![0]).toBeCloseTo(-TARGET_SPACING);
    expect(layout.positions.get('c')![0]).toBeCloseTo(TARGET_SPACING);
    expect(layout.minX).toBeCloseTo(-TARGET_SPACING);
    expect(layout.maxX).toBeCloseTo(TARGET_SPACING);
    expect(layout.radius).toBeCloseTo(TARGET_SPACING);
  });

  it('handles empty and single-node networks', () => {
    expect(computeLayout([]).positions.size).toBe(0);
    const one = computeLayout([{ id: 'a', gridX: 5, gridZ: -3 }]);
    expect(one.positions.get('a')).toEqual([0, 0]);
    expect(one.radius).toBeGreaterThan(0);
  });
});

describe('stats', () => {
  const nodes = transformers.map(fromTransformer);
  it('derives counts, faults and capacity-weighted health of online nodes', () => {
    const s = deriveStats(nodes);
    expect(s).toMatchObject({ total: 3, healthy: 1, warning: 0, critical: 1, offline: 1, activeFaults: 2 });
    expect(s.networkHealth).toBe(Math.round((92 + 35) / 2));
    expect(s.totalLoadKva).toBeCloseTo(0.64 * 500 * 2);
  });

  it('prefers the dashboard summary when present', () => {
    expect(statsFromSummary(summary, nodes)).toMatchObject({ total: 42, healthy: 30, activeFaults: 9, networkHealth: 81 });
    expect(statsFromSummary(undefined, nodes).total).toBe(3);
  });
});
