import { memo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type * as THREE from 'three';
import type { TransformerStatus } from '@/types/api';
import { getGeometries, getMaterials, pulsePhase } from './sharedResources';
import type { SceneTheme } from './utils';

export interface TransformerModelProps {
  id: string;
  position: [number, number, number];
  status: TransformerStatus;
  activeFaultCount: number;
  selected?: boolean;
  hovered?: boolean;
  /** Dimmed by "highlight faults" mode. */
  dimmed?: boolean;
  /** Disable pulse/hover tweening (prefers-reduced-motion). */
  reducedMotion?: boolean;
  theme?: SceneTheme;
  castShadow?: boolean;
  interactive?: boolean;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  /** Slight yaw so a grid of identical models does not look stamped. */
  rotationY?: number;
}

/**
 * A distribution transformer: tank with bevel, radiator fins on both long faces, 3 HV + 3 LV
 * bushings with insulator sheds and cable stubs, conservator, skid. Status drives the emissive band
 * and the beacon; active faults add a pulsing ground ring.
 * All geometry/material instances are shared (see sharedResources.ts).
 */
function TransformerModelImpl({
  id,
  position,
  status,
  activeFaultCount,
  selected = false,
  hovered = false,
  dimmed = false,
  reducedMotion = false,
  theme = 'dark',
  castShadow = false,
  interactive = true,
  onHover,
  onSelect,
  rotationY = 0,
}: TransformerModelProps) {
  const geo = getGeometries();
  const mat = getMaterials(theme);
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const hasFault = activeFaultCount > 0 && !dimmed;
  const targetScale = hovered || selected ? 1.07 : 1;

  useFrame((state, delta) => {
    const g = group.current;
    if (g) {
      const s = g.scale.x;
      if (Math.abs(s - targetScale) > 0.001) {
        const next = reducedMotion ? targetScale : s + (targetScale - s) * Math.min(1, delta * 12);
        g.scale.setScalar(next);
      }
    }
    if (ring.current && !reducedMotion) {
      ring.current.scale.setScalar(1 + 0.18 * pulsePhase(state.clock.elapsedTime));
    }
  });

  const handlers = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover?.(id);
        },
        onPointerOut: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover?.(null);
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect?.(id);
        },
      }
    : {};

  const body = dimmed ? mat.dim : mat.body;
  const fins = dimmed ? mat.dim : mat.fins;
  const metal = dimmed ? mat.dim : mat.metal;
  const porcelain = dimmed ? mat.dim : mat.porcelain;
  const band = dimmed ? mat.bandDim : mat.band[status];

  return (
    <group position={position} dispose={null}>
      <group ref={group} rotation-y={rotationY}>
        <mesh geometry={geo.tank} material={body} castShadow={castShadow} receiveShadow={castShadow} />
        <mesh geometry={geo.fins} material={fins} castShadow={castShadow} />
        <mesh geometry={geo.metal} material={metal} castShadow={castShadow} />
        <mesh geometry={geo.porcelain} material={porcelain} castShadow={castShadow} />
        <mesh geometry={geo.band} material={band} />
        <mesh geometry={geo.beacon} material={dimmed ? mat.bandDim : mat.beacon[status]} />
        {/* Invisible, generous hit volume so hovering thin parts is not fiddly. */}
        {interactive && <mesh geometry={geo.hitBox} material={mat.hit} {...handlers} />}
      </group>
      {hasFault && <mesh ref={ring} geometry={geo.faultRing} material={mat.faultRing} position-y={0.02} />}
      {selected && <mesh geometry={geo.selectRing} material={mat.selectRing} position-y={0.03} />}
      {hovered && !selected && <mesh geometry={geo.hoverRing} material={mat.hoverRing} position-y={0.03} />}
    </group>
  );
}

export const TransformerModel = memo(TransformerModelImpl);

/**
 * Animates the shared status materials once per frame for the whole scene: CRITICAL bands and
 * beacons pulse, the fault ring breathes. OFFLINE never pulses. With reduced motion, static values.
 */
export function StatusPulseDriver({ theme = 'dark', reducedMotion = false }: { theme?: SceneTheme; reducedMotion?: boolean }) {
  const mat = getMaterials(theme);
  const base = theme === 'light' ? 0.35 : 0.9;
  useFrame((state) => {
    if (reducedMotion) {
      mat.band.CRITICAL.emissiveIntensity = base * 1.3;
      mat.faultRing.opacity = 0.6;
      mat.beacon.CRITICAL.color.copy(mat.statusColors.CRITICAL);
      return;
    }
    const p = pulsePhase(state.clock.elapsedTime);
    mat.band.CRITICAL.emissiveIntensity = base * (0.5 + 1.3 * p);
    mat.beacon.CRITICAL.color.copy(mat.statusColors.CRITICAL).multiplyScalar(0.55 + 0.75 * p);
    mat.beacon.WARNING.color.copy(mat.statusColors.WARNING).multiplyScalar(0.85 + 0.15 * p);
    mat.faultRing.opacity = 0.75 - 0.55 * p;
  });
  return null;
}
