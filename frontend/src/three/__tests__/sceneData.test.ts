import { describe, expect, it } from 'vitest';
import { CURVE_SAMPLES, POLE_HEIGHT, buildSpans } from '../curves';
import { getGeometries, getMaterials, pulsePhase } from '../sharedResources';
import { computeLayout, dedupeEdges, fromTransformer } from '../utils';
import { transformers } from './fixtures';

// three.js geometry/material construction runs fine without a WebGL context.
describe('shared transformer resources', () => {
  it('builds merged geometries once and caches them', () => {
    const g = getGeometries();
    expect(g.fins.getAttribute('position').count).toBeGreaterThan(0);
    expect(g.porcelain.getAttribute('position').count).toBeGreaterThan(0);
    expect(g.metal.getAttribute('position').count).toBeGreaterThan(0);
    expect(getGeometries()).toBe(g);
  });

  it('creates one material set per theme with a material per status', () => {
    const dark = getMaterials('dark');
    expect(getMaterials('dark')).toBe(dark);
    expect(getMaterials('light')).not.toBe(dark);
    expect(Object.keys(dark.band).sort()).toEqual(['CRITICAL', 'HEALTHY', 'OFFLINE', 'WARNING']);
    expect(dark.band.CRITICAL.color.getHexString()).toBe('d94a45');
  });

  it('pulse phase stays within [0, 1]', () => {
    for (let t = 0; t < 5; t += 0.13) {
      const p = pulsePhase(t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('buildSpans', () => {
  const nodes = transformers.map(fromTransformer);
  const spans = buildSpans(dedupeEdges(nodes), new Map(nodes.map((n) => [n.id, n])), computeLayout(nodes));

  it('creates one sagging span per deduplicated edge', () => {
    expect(spans).toHaveLength(2);
    for (const s of spans) {
      expect(s.samples).toHaveLength(CURVE_SAMPLES * 3);
      const midY = s.samples[Math.floor(CURVE_SAMPLES / 2) * 3 + 1];
      expect(midY).toBeLessThan(POLE_HEIGHT);
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it('marks spans touching OFFLINE transformers as having no flow', () => {
    const byKey = Object.fromEntries(spans.map((s) => [s.edge.key, s]));
    expect(byKey['tx-001|tx-002'].flow).toBe(true);
    expect(byKey['tx-001|tx-002'].load).toBe(64);
    expect(byKey['tx-002|tx-003'].flow).toBe(false);
  });
});
