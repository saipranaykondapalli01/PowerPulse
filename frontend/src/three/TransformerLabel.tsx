import { memo, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import clsx from 'clsx';
import type { TransformerStatus } from '@/types/api';
import { StatusIcon, STATUS_TEXT_CLASS } from './StatusIcon';
import { statusLabel, type SceneTheme } from './utils';

export interface TransformerLabelProps {
  position: [number, number, number];
  code: string;
  status: TransformerStatus;
  healthScore: number;
  /** Always visible (hovered, selected or faulted). */
  pinned?: boolean;
  /** The selected transformer: drawn with an accent ring so it stands out from hovered/faulted labels. */
  selected?: boolean;
  /** Fade window in camera distance: fully visible below `near`, hidden beyond `far`. */
  near?: number;
  far?: number;
  theme?: SceneTheme;
  compact?: boolean;
}

/**
 * Floating HTML label. Opacity is driven imperatively in useFrame from camera distance, so zooming
 * out hides routine labels (avoiding overlap) without any React re-render.
 */
function TransformerLabelImpl({
  position,
  code,
  status,
  healthScore,
  pinned = false,
  selected = false,
  near = 18,
  far = 30,
  theme = 'dark',
  compact = false,
}: TransformerLabelProps) {
  const el = useRef<HTMLDivElement>(null);
  const anchor = useMemo(() => new THREE.Vector3(...position), [position]);
  const last = useRef(-1);

  useFrame(({ camera }) => {
    const node = el.current;
    if (!node) return;
    let opacity = 1;
    if (!pinned) {
      const d = camera.position.distanceTo(anchor);
      opacity = d <= near ? 1 : d >= far ? 0 : 1 - (d - near) / (far - near);
    }
    if (Math.abs(opacity - last.current) < 0.02) return;
    last.current = opacity;
    node.style.opacity = opacity.toFixed(2);
    node.style.visibility = opacity <= 0.01 ? 'hidden' : 'visible';
  });

  const light = theme === 'light';
  return (
    <Html position={position} center zIndexRange={pinned ? [40, 30] : [20, 0]} style={{ pointerEvents: 'none' }}>
      <div
        ref={el}
        aria-hidden="true"
        className={clsx(
          'flex select-none items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase leading-4 tracking-[0.06em] shadow-sm',
          // Labels are light chips in both themes (the dark scene keeps its technical treatment around them).
          light ? 'border-ink/20 bg-paper/95 text-ink' : 'border-line bg-panel/95 text-fg',
          pinned && (light ? 'border-ink/60' : 'border-line-strong'),
          selected && 'border-ink ring-2 ring-accent',
        )}
        style={{ transition: 'opacity 150ms linear' }}
      >
        <span className="font-semibold">{code}</span>
        <span className={clsx('inline-flex items-center gap-0.5', STATUS_TEXT_CLASS[status])}>
          <StatusIcon status={status} size={11} strokeWidth={2.5} />
          {!compact && statusLabel(status)}
        </span>
        {status !== 'OFFLINE' && <span className={light ? 'text-muted' : 'text-fg-muted'}>{Math.round(healthScore)}</span>}
      </div>
    </Html>
  );
}

export const TransformerLabel = memo(TransformerLabelImpl);
