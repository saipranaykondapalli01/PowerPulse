/**
 * Geometries and materials shared by every transformer in every scene. Created lazily once per
 * theme and never recreated, so N transformers cost N meshes but only one set of GPU buffers.
 * Meshes reference these through props, so R3F never disposes them on unmount.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TransformerStatus } from '@/types/api';
import { ACCENT_HEX, STATUS_ORDER, statusColor, type SceneTheme } from './utils';

// ---- Dimensions (scene units) ----
export const TANK = { w: 1.7, h: 1.3, d: 1.1, y: 0.12 + 0.65 };
export const TANK_TOP = TANK.y + TANK.h / 2; // 1.42
export const LABEL_HEIGHT = 2.75;
export const FOOTPRINT_RADIUS = 1.5;

export interface TransformerGeometries {
  tank: THREE.BufferGeometry;
  fins: THREE.BufferGeometry;
  porcelain: THREE.BufferGeometry;
  metal: THREE.BufferGeometry;
  band: THREE.BufferGeometry;
  beacon: THREE.BufferGeometry;
  faultRing: THREE.BufferGeometry;
  selectRing: THREE.BufferGeometry;
  hoverRing: THREE.BufferGeometry;
  hitBox: THREE.BufferGeometry;
}

function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = geo.clone();
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/** Strip attributes so geometries with/without uv or index can be merged. */
function normalize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(ng.attributes)) {
    if (name !== 'position' && name !== 'normal') ng.deleteAttribute(name);
  }
  return ng;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts.map(normalize), false);
  if (!merged) throw new Error('Failed to merge transformer geometry');
  merged.computeBoundingSphere();
  return merged;
}

let geometries: TransformerGeometries | null = null;

export function getGeometries(): TransformerGeometries {
  if (geometries) return geometries;

  const tank = new RoundedBoxGeometry(TANK.w, TANK.h, TANK.d, 2, 0.06);
  tank.translate(0, TANK.y, 0);

  // Cooling fins: thin radiator plates in a row along both long faces (one merged draw call).
  const fin = new THREE.BoxGeometry(0.035, 0.98, 0.3);
  const finParts: THREE.BufferGeometry[] = [];
  const finCount = 11;
  for (let i = 0; i < finCount; i++) {
    const x = -0.7 + (1.4 * i) / (finCount - 1);
    finParts.push(at(fin, x, TANK.y - 0.02, TANK.d / 2 + 0.15));
    finParts.push(at(fin, x, TANK.y - 0.02, -(TANK.d / 2 + 0.15)));
  }
  // Radiator headers tying the fins together.
  const header = new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8);
  for (const side of [1, -1]) {
    finParts.push(at(header, 0, TANK.y + 0.45, side * (TANK.d / 2 + 0.15), 0, Math.PI / 2));
    finParts.push(at(header, 0, TANK.y - 0.49, side * (TANK.d / 2 + 0.15), 0, Math.PI / 2));
  }

  // Bushings: 3 HV (tall) + 3 LV (short), each a core with stacked insulator sheds.
  const core = new THREE.CylinderGeometry(0.04, 0.05, 1, 10);
  const shed = new THREE.CylinderGeometry(0.1, 0.11, 0.03, 14);
  const porcelainParts: THREE.BufferGeometry[] = [];
  const metalParts: THREE.BufferGeometry[] = [];
  const cap = new THREE.CylinderGeometry(0.055, 0.055, 0.07, 10);
  const stub = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6);

  const bushing = (x: number, z: number, height: number, sheds: number, outward: number) => {
    const c = core.clone();
    c.scale(1, height, 1);
    porcelainParts.push(at(c, x, TANK_TOP + height / 2, z));
    for (let i = 0; i < sheds; i++) {
      porcelainParts.push(at(shed, x, TANK_TOP + 0.1 + (i * (height - 0.18)) / Math.max(1, sheds - 1), z));
    }
    const topY = TANK_TOP + height;
    metalParts.push(at(cap, x, topY + 0.035, z));
    // Cable stub leaving the terminal at 45° outward.
    metalParts.push(at(stub, x, topY + 0.16, z + outward * 0.14, outward * (Math.PI / 4)));
  };
  for (const x of [-0.5, 0, 0.5]) bushing(x, -0.05, 0.78, 7, -1);
  for (const x of [-0.45, 0, 0.45]) bushing(x, 0.36, 0.42, 4, 1);

  // Skid rails, lid, conservator tank + supports, beacon post.
  metalParts.push(at(new THREE.BoxGeometry(2.0, 0.12, 0.16), 0, 0.06, 0.38));
  metalParts.push(at(new THREE.BoxGeometry(2.0, 0.12, 0.16), 0, 0.06, -0.38));
  metalParts.push(at(new THREE.BoxGeometry(1.78, 0.05, 1.18), 0, TANK_TOP + 0.02, 0));
  metalParts.push(at(new THREE.CylinderGeometry(0.15, 0.15, 1.15, 14), 0, TANK_TOP + 0.5, -0.45, 0, Math.PI / 2));
  for (const x of [-0.42, 0.42]) {
    metalParts.push(at(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), x, TANK_TOP + 0.2, -0.45));
  }
  metalParts.push(at(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), 0.78, TANK_TOP + 0.15, 0.46));

  const band = new THREE.BoxGeometry(TANK.w + 0.04, 0.09, TANK.d + 0.04);
  band.translate(0, TANK_TOP - 0.2, 0);

  const beacon = new THREE.SphereGeometry(0.09, 16, 12);
  beacon.translate(0.78, TANK_TOP + 0.36, 0.46);

  const ring = (inner: number, outer: number, segments: number) => {
    const g = new THREE.RingGeometry(inner, outer, segments);
    g.rotateX(-Math.PI / 2);
    return g;
  };

  const hitBox = new THREE.BoxGeometry(2.2, 2.6, 2.0);
  hitBox.translate(0, 1.3, 0);

  geometries = {
    tank,
    fins: merge(finParts),
    porcelain: merge(porcelainParts),
    metal: merge(metalParts),
    band,
    beacon,
    faultRing: ring(1.35, 1.5, 48),
    selectRing: ring(1.68, 1.8, 64),
    hoverRing: ring(1.68, 1.74, 64),
    hitBox,
  };
  return geometries;
}

// ---- Materials ----
export interface TransformerMaterials {
  body: THREE.MeshStandardMaterial;
  fins: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  porcelain: THREE.MeshStandardMaterial;
  dim: THREE.MeshStandardMaterial;
  band: Record<TransformerStatus, THREE.MeshStandardMaterial>;
  bandDim: THREE.MeshBasicMaterial;
  beacon: Record<TransformerStatus, THREE.MeshBasicMaterial>;
  faultRing: THREE.MeshBasicMaterial;
  selectRing: THREE.MeshBasicMaterial;
  hoverRing: THREE.MeshBasicMaterial;
  hit: THREE.MeshBasicMaterial;
  /** Base colors used by the pulse driver to restore/animate. */
  statusColors: Record<TransformerStatus, THREE.Color>;
}

const materialCache: Partial<Record<SceneTheme, TransformerMaterials>> = {};

export function getMaterials(theme: SceneTheme): TransformerMaterials {
  const cached = materialCache[theme];
  if (cached) return cached;
  const light = theme === 'light';

  const statusColors = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, new THREE.Color(statusColor(s, theme))]),
  ) as Record<TransformerStatus, THREE.Color>;

  const band = Object.fromEntries(
    STATUS_ORDER.map((s) => {
      const offline = s === 'OFFLINE';
      return [
        s,
        new THREE.MeshStandardMaterial({
          color: statusColors[s],
          emissive: statusColors[s],
          emissiveIntensity: offline ? 0.05 : light ? 0.35 : 0.9,
          roughness: 0.4,
          metalness: 0.1,
        }),
      ];
    }),
  ) as Record<TransformerStatus, THREE.MeshStandardMaterial>;

  const beacon = Object.fromEntries(
    STATUS_ORDER.map((s) => [
      s,
      new THREE.MeshBasicMaterial({ color: statusColors[s].clone(), toneMapped: false }),
    ]),
  ) as Record<TransformerStatus, THREE.MeshBasicMaterial>;

  const mats: TransformerMaterials = {
    body: new THREE.MeshStandardMaterial({
      color: light ? '#B7BBB0' : '#6A7264',
      roughness: 0.55,
      metalness: 0.45,
    }),
    fins: new THREE.MeshStandardMaterial({
      color: light ? '#A3A79C' : '#565D51',
      roughness: 0.6,
      metalness: 0.4,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: light ? '#4E5249' : '#3A3F36',
      roughness: 0.5,
      metalness: 0.6,
    }),
    porcelain: new THREE.MeshStandardMaterial({
      color: light ? '#8C6E52' : '#A08670',
      roughness: 0.35,
      metalness: 0.05,
    }),
    dim: new THREE.MeshStandardMaterial({
      color: light ? '#C9CBC2' : '#262A23',
      roughness: 0.9,
      metalness: 0,
      transparent: true,
      opacity: light ? 0.45 : 0.4,
    }),
    band,
    bandDim: new THREE.MeshBasicMaterial({
      color: light ? '#B9BBB2' : '#3A3E36',
      transparent: true,
      opacity: 0.5,
    }),
    beacon,
    faultRing: new THREE.MeshBasicMaterial({
      color: statusColors.CRITICAL.clone(),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    selectRing: new THREE.MeshBasicMaterial({
      color: light ? '#151713' : ACCENT_HEX,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    hoverRing: new THREE.MeshBasicMaterial({
      color: light ? '#151713' : '#ECEBE4',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
    statusColors,
  };
  // Offline beacons are desaturated and dark: no "alive" glow.
  mats.beacon.OFFLINE.color.multiplyScalar(0.6);
  materialCache[theme] = mats;
  return mats;
}

/** Pulse phase in [0, 1] shared by every animated element so the network breathes in sync. */
export function pulsePhase(elapsed: number, hz = 0.9): number {
  return 0.5 + 0.5 * Math.sin(elapsed * Math.PI * 2 * hz);
}
