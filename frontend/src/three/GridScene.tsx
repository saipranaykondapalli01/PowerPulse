import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { CameraRig, overviewPose, type ViewMode } from './CameraRig';
import { buildSpans } from './curves';
import { FlowParticles } from './FlowParticles';
import { NetworkLines } from './NetworkLines';
import { LABEL_HEIGHT } from './sharedResources';
import { StatusPulseDriver, TransformerModel } from './TransformerModel';
import { TransformerLabel } from './TransformerLabel';
import { TARGET_SPACING, computeLayout, dedupeEdges, type GridNode, type SceneTheme } from './utils';
import type { RenderQuality } from './webgl';

export interface GridSceneProps {
  /** Every transformer (layout is computed from all of them so filtering never re-centers the map). */
  nodes: GridNode[];
  /** Ids to render; omitted = all. */
  visibleIds?: Set<string>;
  selectedId?: string | null;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  /** Click on empty space. */
  onClearSelection?: () => void;
  highlightFaults?: boolean;
  viewMode?: ViewMode;
  /** Increment to replay the current camera move (Focus / Reset). */
  cameraToken?: number;
  reducedMotion?: boolean;
  quality?: RenderQuality;
  theme?: SceneTheme;
  /** 'auto': distance-faded labels for all, pinned for hovered/selected/faulted. 'hover': only hovered. */
  labels?: 'auto' | 'hover' | 'none';
  interactive?: boolean;
  /** Slowly orbit until the user interacts (landing preview). Ignored with reduced motion. */
  autoRotate?: boolean;
  /** Flow particles per edge at 100 % load. */
  maxParticlesPerEdge?: number;
  onReady?: () => void;
  className?: string;
}

const PALETTE: Record<SceneTheme, { bg: string; ground: string; cell: string; section: string; sky: string; earth: string }> = {
  dark: { bg: '#0F110E', ground: '#11140F', cell: '#272D24', section: '#3B4436', sky: '#C9D3C0', earth: '#151713' },
  light: { bg: '#F2F0E9', ground: '#F2F0E9', cell: '#D8D5C9', section: '#B9B5A7', sky: '#FFFFFF', earth: '#B8B4A6' },
};

/**
 * The interactive 3D network. Pure presentation: all data arrives via props.
 * This module (and three.js) is only loaded through React.lazy, never in unit tests.
 */
export default function GridScene({
  nodes,
  visibleIds,
  selectedId = null,
  hoveredId = null,
  onHover,
  onSelect,
  onClearSelection,
  highlightFaults = false,
  viewMode = 'overview',
  cameraToken = 0,
  reducedMotion = false,
  quality = 'high',
  theme = 'dark',
  labels = 'auto',
  interactive = true,
  autoRotate = false,
  maxParticlesPerEdge,
  onReady,
  className,
}: GridSceneProps) {
  const [userInteracted, setUserInteracted] = useState(false);
  const palette = PALETTE[theme];
  const shadows = quality === 'high';

  // Re-layout only when positions/membership change, not on every 10 s status poll.
  const layoutKey = nodes.map((n) => `${n.id}:${n.gridX}:${n.gridZ}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => computeLayout(nodes), [layoutKey]);
  const visible = useMemo(
    () => (visibleIds ? nodes.filter((n) => visibleIds.has(n.id)) : nodes),
    [nodes, visibleIds],
  );
  const nodesById = useMemo(() => new Map(visible.map((n) => [n.id, n])), [visible]);
  const spans = useMemo(() => buildSpans(dedupeEdges(visible), nodesById, layout), [visible, nodesById, layout]);

  const positions = useMemo(() => {
    const m = new Map<string, { model: [number, number, number]; label: [number, number, number] }>();
    for (const n of visible) {
      const p = layout.positions.get(n.id) ?? [0, 0];
      m.set(n.id, { model: [p[0], 0, p[1]], label: [p[0], LABEL_HEIGHT, p[1]] });
    }
    return m;
  }, [visible, layout]);

  // Pointer cursor while a rendered transformer is hovered; always restored on unmount.
  const hoveringModel = interactive && !!hoveredId && nodesById.has(hoveredId);
  useEffect(() => {
    document.body.style.cursor = hoveringModel ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hoveringModel]);

  const selectedPos = selectedId ? layout.positions.get(selectedId) ?? null : null;
  const initial = useMemo(() => overviewPose(layout.radius), [layout.radius]);
  const extent = layout.radius * 2 + 30;
  // Labels stay readable at the overview distance for small networks; crowded networks fade sooner.
  const overviewDistance = layout.radius * 2.2 + 9;
  const crowded = visible.length > 30;
  const labelNear = crowded ? 12 : Math.max(20, overviewDistance * 1.1);
  const labelFar = crowded ? 20 : labelNear + 14;
  const particlesPerEdge = maxParticlesPerEdge ?? (quality === 'low' ? 4 : 8);

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        dpr={quality === 'low' ? [1, 1.25] : [1, 1.5]}
        shadows={shadows}
        frameloop={reducedMotion ? 'demand' : 'always'}
        camera={{ fov: 42, near: 0.1, far: 600, position: initial.position }}
        gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
        onCreated={() => onReady?.()}
        onPointerMissed={() => onClearSelection?.()}
        aria-label="3D transformer network"
      >
        <color attach="background" args={[palette.bg]} />
        <fog attach="fog" args={[palette.bg, overviewDistance * 1.05, overviewDistance * 3 + 20]} />
        <hemisphereLight args={[palette.sky, palette.earth, theme === 'light' ? 1.3 : 1.25]} />
        <directionalLight
          position={[layout.radius * 0.5 + 10, 22, layout.radius * 0.35 + 8]}
          intensity={theme === 'light' ? 1.8 : 2.2}
          castShadow={shadows}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0005}
          shadow-camera-left={-(layout.radius + 6)}
          shadow-camera-right={layout.radius + 6}
          shadow-camera-top={layout.radius + 6}
          shadow-camera-bottom={-(layout.radius + 6)}
          shadow-camera-near={1}
          shadow-camera-far={layout.radius * 3 + 60}
        />

        {/* Unlit ground matches the page background exactly; a shadow-only plane sits on top. */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
          <planeGeometry args={[extent * 3, extent * 3]} />
          <meshBasicMaterial color={palette.ground} toneMapped={false} />
        </mesh>
        {shadows && (
          <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
            <planeGeometry args={[extent * 3, extent * 3]} />
            <shadowMaterial transparent opacity={theme === 'light' ? 0.14 : 0.35} />
          </mesh>
        )}
        <Grid
          position-y={0.002}
          args={[extent, extent]}
          cellSize={1}
          cellThickness={0.6}
          cellColor={palette.cell}
          sectionSize={TARGET_SPACING}
          sectionThickness={1}
          sectionColor={palette.section}
          fadeDistance={extent * 1.2}
          fadeStrength={1.5}
          infiniteGrid
        />

        <Suspense fallback={null}>
          <StatusPulseDriver theme={theme} reducedMotion={reducedMotion} />
          <NetworkLines spans={spans} theme={theme} castShadow={shadows} />
          <FlowParticles
            spans={spans}
            maxPerEdge={particlesPerEdge}
            reducedMotion={reducedMotion}
            theme={theme}
            size={theme === 'light' ? 0.085 : 0.065}
          />
          {visible.map((n) => {
            const p = positions.get(n.id)!;
            const hovered = hoveredId === n.id;
            const selected = selectedId === n.id;
            const faulted = n.activeFaultCount > 0 || n.status === 'CRITICAL';
            const showLabel = labels === 'auto' || (labels === 'hover' && hovered);
            return (
              <group key={n.id}>
                <TransformerModel
                  id={n.id}
                  position={p.model}
                  status={n.status}
                  activeFaultCount={n.activeFaultCount}
                  selected={selected}
                  hovered={hovered}
                  dimmed={highlightFaults && n.activeFaultCount === 0}
                  reducedMotion={reducedMotion}
                  theme={theme}
                  castShadow={shadows}
                  interactive={interactive}
                  onHover={onHover}
                  onSelect={onSelect}
                />
                {showLabel && (
                  <TransformerLabel
                    position={p.label}
                    code={n.code}
                    status={n.status}
                    healthScore={n.healthScore}
                    pinned={hovered || selected || (labels === 'auto' && faulted)}
                    selected={selected}
                    near={labelNear}
                    far={labelFar}
                    theme={theme}
                  />
                )}
              </group>
            );
          })}
        </Suspense>

        <OrbitControls
          makeDefault
          enabled={interactive}
          enableDamping={!reducedMotion}
          dampingFactor={0.08}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={4}
          maxDistance={layout.radius * 3.2 + 24}
          enablePan={interactive}
          autoRotate={autoRotate && !reducedMotion && !userInteracted}
          autoRotateSpeed={0.35}
          onStart={() => setUserInteracted(true)}
        />
        <CameraRig
          mode={viewMode}
          focus={viewMode === 'individual' ? selectedPos : null}
          radius={layout.radius}
          token={cameraToken}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}
