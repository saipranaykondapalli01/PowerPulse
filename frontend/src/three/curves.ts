/**
 * Builds the overhead-line geometry for each network edge: a pole near each endpoint, a sagging
 * (catenary-like) quadratic Bézier span between pole tops, and a pre-sampled point table that the
 * flow particles interpolate without allocating per frame.
 */
import * as THREE from 'three';
import { edgeHasFlow, edgeLoad, type Edge, type GridNode, type SceneLayout } from './utils';

export const POLE_HEIGHT = 2.7;
export const CURVE_SAMPLES = 32;

export interface EdgeSpan {
  edge: Edge;
  /** Pole base positions [x, z] at each end. */
  poleA: [number, number];
  poleB: [number, number];
  /** Yaw of the line in the XZ plane (for cross-arms). */
  yaw: number;
  curve: THREE.QuadraticBezierCurve3;
  /** CURVE_SAMPLES points (xyz) along the span, A → B. */
  samples: Float32Array;
  /** Drop cables from pole top down to each transformer terminal. */
  dropA: [THREE.Vector3, THREE.Vector3];
  dropB: [THREE.Vector3, THREE.Vector3];
  length: number;
  load: number | null;
  flow: boolean;
}

export function buildSpans(edges: Edge[], nodesById: Map<string, GridNode>, layout: SceneLayout): EdgeSpan[] {
  const spans: EdgeSpan[] = [];
  for (const edge of edges) {
    const a = nodesById.get(edge.a);
    const b = nodesById.get(edge.b);
    const pa = layout.positions.get(edge.a);
    const pb = layout.positions.get(edge.b);
    if (!a || !b || !pa || !pb) continue;
    const dx = pb[0] - pa[0];
    const dz = pb[1] - pa[1];
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-6) continue;
    const ux = dx / dist;
    const uz = dz / dist;
    const offset = Math.min(2.1, dist * 0.3);
    const poleA: [number, number] = [pa[0] + ux * offset, pa[1] + uz * offset];
    const poleB: [number, number] = [pb[0] - ux * offset, pb[1] - uz * offset];
    const start = new THREE.Vector3(poleA[0], POLE_HEIGHT, poleA[1]);
    const end = new THREE.Vector3(poleB[0], POLE_HEIGHT, poleB[1]);
    const span = start.distanceTo(end);
    const sag = Math.max(0.15, span * 0.06);
    // Quadratic Bézier midpoint = (start + 2·control + end)/4, so control sits 2·sag below.
    const control = new THREE.Vector3((start.x + end.x) / 2, POLE_HEIGHT - 2 * sag, (start.z + end.z) / 2);
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    const samples = new Float32Array(CURVE_SAMPLES * 3);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < CURVE_SAMPLES; i++) {
      curve.getPoint(i / (CURVE_SAMPLES - 1), tmp);
      samples[i * 3] = tmp.x;
      samples[i * 3 + 1] = tmp.y;
      samples[i * 3 + 2] = tmp.z;
    }
    const terminalA = new THREE.Vector3(pa[0] + ux * 0.6, 2.0, pa[1] + uz * 0.6);
    const terminalB = new THREE.Vector3(pb[0] - ux * 0.6, 2.0, pb[1] - uz * 0.6);
    spans.push({
      edge,
      poleA,
      poleB,
      yaw: Math.atan2(dx, dz),
      curve,
      samples,
      dropA: [start.clone(), terminalA],
      dropB: [end.clone(), terminalB],
      length: curve.getLength(),
      load: edgeLoad(a, b),
      flow: edgeHasFlow(a, b),
    });
  }
  return spans;
}
