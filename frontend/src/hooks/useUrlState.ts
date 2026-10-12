import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Read/write URL search params as a flat string record.
 * `set({a: 'x', b: undefined})` updates `a`, removes `b`, keeps the rest. Uses replace to avoid history spam.
 */
export function useUrlState() {
  const [params, setParams] = useSearchParams();

  const get = useCallback((key: string) => params.get(key) ?? undefined, [params]);
  const getNumber = useCallback(
    (key: string) => {
      const v = params.get(key);
      if (v === null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    },
    [params],
  );

  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, opts: { resetPage?: boolean } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === null || v === '') next.delete(k);
            else next.set(k, String(v));
          }
          if (opts.resetPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { params, get, getNumber, set };
}
