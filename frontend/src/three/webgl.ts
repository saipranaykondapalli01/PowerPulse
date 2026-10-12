/**
 * Capability detection for the network views. Kept free of three.js so the page can decide between
 * the 3D scene and the 2D SVG fallback without downloading the 3D chunk.
 */
import { useEffect, useState } from 'react';

let cachedWebGL: boolean | null = null;

/** True when a WebGL (2 or 1) context can be created. Result is cached for the session. */
export function isWebGLAvailable(): boolean {
  if (cachedWebGL !== null) return cachedWebGL;
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return (cachedWebGL = false);
    if (!('WebGLRenderingContext' in window)) return (cachedWebGL = false);
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    cachedWebGL = !!gl;
    // Release the probe context right away so it does not count against the browser's context limit.
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedWebGL = false;
  }
  return cachedWebGL;
}

/** Very low-end hardware (≤ 2 logical cores): default to the 2D map. */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency;
  return typeof cores === 'number' && cores > 0 && cores <= 2;
}

/** Touch-first or narrow screens get reduced quality (no shadows, fewer particles, lower dpr). */
export function isMobileLike(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 767px)').matches;
}

function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export type RenderQuality = 'high' | 'low';

export interface RenderCapabilities {
  webgl: boolean;
  lowEnd: boolean;
  reducedMotion: boolean;
  quality: RenderQuality;
}

/** Combined capability snapshot used by GridPage and NetworkPreview. */
export function useRenderCapabilities(): RenderCapabilities {
  const reducedMotion = usePrefersReducedMotion();
  const [snapshot] = useState(() => ({
    webgl: isWebGLAvailable(),
    lowEnd: isLowEndDevice(),
    quality: (isMobileLike() ? 'low' : 'high') as RenderQuality,
  }));
  return { ...snapshot, reducedMotion };
}
