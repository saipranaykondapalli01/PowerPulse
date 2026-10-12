import { useLayoutEffect, useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { POLE_HEIGHT, type EdgeSpan } from './curves';
import type { SceneTheme } from './utils';

const LINE_POINTS = 20;

const poleGeometry = new THREE.CylinderGeometry(0.045, 0.06, POLE_HEIGHT, 6).translate(0, POLE_HEIGHT / 2, 0);
const armGeometry = new THREE.BoxGeometry(0.75, 0.05, 0.05).translate(0, POLE_HEIGHT - 0.12, 0);
const poleMaterials: Record<SceneTheme, THREE.MeshStandardMaterial> = {
  dark: new THREE.MeshStandardMaterial({ color: '#5B5F54', roughness: 0.8 }),
  light: new THREE.MeshStandardMaterial({ color: '#3E413A', roughness: 0.8 }),
};

const LINE_COLORS: Record<SceneTheme, { live: string; dead: string }> = {
  dark: { live: '#8E9784', dead: '#3F443B' },
  light: { live: '#151713', dead: '#A9AAA2' },
};

export interface NetworkLinesProps {
  spans: EdgeSpan[];
  theme?: SceneTheme;
  castShadow?: boolean;
}

/**
 * All overhead spans in one LineSegments2 draw call (vertex-colored), plus every pole and
 * cross-arm in two InstancedMeshes. Spans touching an OFFLINE transformer are drawn dim.
 */
export function NetworkLines({ spans, theme = 'dark', castShadow = false }: NetworkLinesProps) {
  const { points, colors } = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const cols: [number, number, number][] = [];
    const live = new THREE.Color(LINE_COLORS[theme].live);
    const dead = new THREE.Color(LINE_COLORS[theme].dead);
    for (const s of spans) {
      const c = s.flow ? live : dead;
      const rgb: [number, number, number] = [c.r, c.g, c.b];
      const curvePts = s.curve.getPoints(LINE_POINTS);
      for (let i = 0; i < curvePts.length - 1; i++) {
        pts.push(curvePts[i], curvePts[i + 1]);
        cols.push(rgb, rgb);
      }
      for (const [p, q] of [s.dropA, s.dropB]) {
        pts.push(p, q);
        cols.push(rgb, rgb);
      }
    }
    return { points: pts, colors: cols };
  }, [spans, theme]);

  const poleCount = spans.length * 2;
  const poles = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!poles.current || !arms.current) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    spans.forEach((s, i) => {
      // Cross-arm perpendicular to the span direction.
      q.setFromAxisAngle(up, s.yaw);
      [s.poleA, s.poleB].forEach((p, j) => {
        pos.set(p[0], 0, p[1]);
        m.compose(pos, q, one);
        poles.current!.setMatrixAt(i * 2 + j, m);
        arms.current!.setMatrixAt(i * 2 + j, m);
      });
    });
    poles.current.instanceMatrix.needsUpdate = true;
    arms.current.instanceMatrix.needsUpdate = true;
    poles.current.computeBoundingSphere();
    arms.current.computeBoundingSphere();
  }, [spans]);

  if (spans.length === 0) return null;

  return (
    <group>
      <Line
        points={points}
        vertexColors={colors}
        segments
        lineWidth={theme === 'light' ? 1.4 : 1.6}
        transparent
        opacity={0.9}
      />
      <instancedMesh
        key={`p${poleCount}`}
        ref={poles}
        dispose={null}
        args={[poleGeometry, poleMaterials[theme], poleCount]}
        castShadow={castShadow}
      />
      <instancedMesh key={`a${poleCount}`} ref={arms} dispose={null} args={[armGeometry, poleMaterials[theme], poleCount]} />
    </group>
  );
}
