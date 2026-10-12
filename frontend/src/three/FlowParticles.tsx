import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CURVE_SAMPLES, type EdgeSpan } from './curves';
import { ACCENT_HEX, TARGET_SPACING, particleDensity, particleSpeed, statusColor, type SceneTheme } from './utils';

const particleGeometry = new THREE.SphereGeometry(1, 8, 6);
const particleMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
const HIGH_LOAD_PCT = 90;

export interface FlowParticlesProps {
  spans: EdgeSpan[];
  /** Particles per edge at 100 % load (lower on mobile / landing). */
  maxPerEdge?: number;
  /** When true, particles are placed once and never move. */
  reducedMotion?: boolean;
  theme?: SceneTheme;
  size?: number;
}

interface ParticleTable {
  count: number;
  edgeOf: Uint16Array;
  offset: Float32Array;
  /** Per edge: fraction of the span travelled per second. */
  speed: Float32Array;
  samples: Float32Array[];
  highLoad: Uint8Array;
}

function buildTable(spans: EdgeSpan[], maxPerEdge: number): ParticleTable {
  const perEdge = spans.map((s) => (s.flow ? particleDensity(s.load, maxPerEdge) : 0));
  const count = perEdge.reduce((a, b) => a + b, 0);
  const edgeOf = new Uint16Array(count);
  const offset = new Float32Array(count);
  const speed = new Float32Array(spans.length);
  const highLoad = new Uint8Array(spans.length);
  let k = 0;
  spans.forEach((s, e) => {
    speed[e] = (particleSpeed(s.load) * TARGET_SPACING) / Math.max(1, s.length);
    highLoad[e] = (s.load ?? 0) >= HIGH_LOAD_PCT ? 1 : 0;
    for (let i = 0; i < perEdge[e]; i++) {
      edgeOf[k] = e;
      // Even spacing with a per-edge phase so neighbouring lines do not move in lockstep.
      offset[k] = (i / perEdge[e] + e * 0.137) % 1;
      k++;
    }
  });
  return { count, edgeOf, offset, speed, samples: spans.map((s) => s.samples), highLoad };
}

/**
 * Energy-flow particles for every live span in ONE InstancedMesh. Positions are interpolated from
 * pre-sampled curve tables in useFrame with no allocations and no React state updates.
 * Density and speed scale with the mean load of each span's endpoints; spans touching OFFLINE
 * transformers carry no particles. This is a visualization of simulated load, not power-flow.
 */
export function FlowParticles({
  spans,
  maxPerEdge = 8,
  reducedMotion = false,
  theme = 'dark',
  size = 0.075,
}: FlowParticlesProps) {
  const table = useMemo(() => buildTable(spans, maxPerEdge), [spans, maxPerEdge]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  const place = (elapsed: number) => {
    const m = mesh.current;
    if (!m) return;
    const { count, edgeOf, offset, speed, samples } = table;
    const last = CURVE_SAMPLES - 1;
    for (let i = 0; i < count; i++) {
      const e = edgeOf[i];
      let t = (offset[i] + elapsed * speed[e]) % 1;
      if (t < 0) t += 1;
      const f = t * last;
      const i0 = Math.min(last - 1, Math.floor(f));
      const frac = f - i0;
      const s = samples[e];
      const a = i0 * 3;
      const b = a + 3;
      matrix.makeScale(size, size, size);
      matrix.setPosition(
        s[a] + (s[b] - s[a]) * frac,
        s[a + 1] + (s[b + 1] - s[a + 1]) * frac,
        s[a + 2] + (s[b + 2] - s[a + 2]) * frac,
      );
      m.setMatrixAt(i, matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const normal = new THREE.Color(theme === 'light' ? '#8DB31F' : ACCENT_HEX);
    const hot = new THREE.Color(statusColor('WARNING', theme));
    for (let i = 0; i < table.count; i++) {
      m.setColorAt(i, table.highLoad[table.edgeOf[i]] ? hot : normal);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    place(0);
    // Bounding sphere would otherwise be computed from the origin-placed instances only.
    m.frustumCulled = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, theme, size]);

  useFrame((state) => {
    if (reducedMotion) return;
    place(state.clock.elapsedTime);
  });

  if (table.count === 0) return null;
  return (
    <instancedMesh
      key={table.count}
      ref={mesh}
      dispose={null}
      args={[particleGeometry, particleMaterial, table.count]}
    />
  );
}
