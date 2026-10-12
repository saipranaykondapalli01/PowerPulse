import { useCallback, useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query. Returns false when matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener?.('change', onChange);
      return () => mql.removeEventListener?.('change', onChange);
    },
    [query],
  );
  const get = () => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(query).matches : false);
  return useSyncExternalStore(subscribe, get, () => false);
}

export const DESKTOP_QUERY = '(min-width: 768px)';
