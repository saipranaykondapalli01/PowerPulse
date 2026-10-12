import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export type ViewMode = 'overview' | 'individual';

/** Camera position/target for the whole-network overview, framed from the layout radius. */
export function overviewPose(radius: number): { position: [number, number, number]; target: [number, number, number] } {
  const d = radius * 2.2 + 9;
  const dir = new THREE.Vector3(0.38, 0.78, 0.98).normalize().multiplyScalar(d);
  return { position: [dir.x, dir.y, dir.z], target: [0, 0, 0] };
}

/** Camera pose that frames a single transformer at scene position (x, z). */
export function individualPose(x: number, z: number): { position: [number, number, number]; target: [number, number, number] } {
  return { position: [x + 4.6, 4.4, z + 6.4], target: [x, 1.1, z] };
}

export interface CameraRigProps {
  mode: ViewMode;
  /** Scene-space [x, z] of the focused transformer (used in 'individual' mode). */
  focus: [number, number] | null;
  radius: number;
  /** Increment to replay the move to the same pose (e.g. "Focus" / "Reset view" clicks). */
  token: number;
  reducedMotion?: boolean;
}

/**
 * Smoothly eases the camera and the OrbitControls target to the requested pose. User input
 * (OrbitControls "start") cancels an in-flight move so the camera never fights the user.
 */
export function CameraRig({ mode, focus, radius, token, reducedMotion = false }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  const goal = useRef({ position: new THREE.Vector3(), target: new THREE.Vector3(), active: false });

  const fx = focus?.[0];
  const fz = focus?.[1];

  useEffect(() => {
    const pose =
      mode === 'individual' && fx !== undefined && fz !== undefined ? individualPose(fx, fz) : overviewPose(radius);
    goal.current.position.set(...pose.position);
    goal.current.target.set(...pose.target);
    goal.current.active = true;
    if (reducedMotion && controls) {
      camera.position.copy(goal.current.position);
      controls.target.copy(goal.current.target);
      controls.update();
      goal.current.active = false;
    }
    invalidate();
  }, [mode, fx, fz, radius, token, reducedMotion, camera, controls, invalidate]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      goal.current.active = false;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useFrame((_, delta) => {
    const g = goal.current;
    if (!g.active || !controls) return;
    const k = 1 - Math.exp(-delta * 4.5);
    camera.position.lerp(g.position, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceToSquared(g.position) < 1e-4 && controls.target.distanceToSquared(g.target) < 1e-4) {
      g.active = false;
    } else {
      invalidate();
    }
  });

  return null;
}
