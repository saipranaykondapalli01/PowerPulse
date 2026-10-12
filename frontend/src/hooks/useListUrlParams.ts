import { useCallback, useMemo } from 'react';
import { useUrlState } from './useUrlState';
import type { SortState } from '@/components/ui/Table';
import type { DateRange } from '@/components/ui/DateRangePicker';

/**
 * Server-side sort bound to the `sort` URL param ("field,dir").
 * `fields` maps a table column key to the backend sort field.
 */
export function useServerSort(defaultSort: string, fields: Record<string, string>) {
  const { get, set } = useUrlState();
  const raw = get('sort');
  const [field, dir] = (raw ?? defaultSort).split(',');
  const valid = Object.values(fields).includes(field);
  const sort = valid ? `${field},${dir === 'asc' ? 'asc' : 'desc'}` : defaultSort;
  const tableSort = useMemo<SortState | null>(() => {
    const [f, d] = sort.split(',');
    const key = Object.entries(fields).find(([, v]) => v === f)?.[0];
    return key ? { key, dir: d === 'asc' ? 'asc' : 'desc' } : null;
    // fields is a module-level constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);
  const onSortChange = useCallback(
    (s: SortState) => {
      const next = `${fields[s.key]},${s.dir}`;
      set({ sort: next === defaultSort ? undefined : next }, { resetPage: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set, defaultSort],
  );
  return { sort, tableSort, onSortChange };
}

/** `page` (zero-based) and `size` URL params. */
export function usePageParams(defaultSize = 20) {
  const { getNumber, set } = useUrlState();
  const page = Math.max(0, getNumber('page') ?? 0);
  const size = getNumber('size') ?? defaultSize;
  const setPage = useCallback((p: number) => set({ page: p || undefined }), [set]);
  const setSize = useCallback(
    (s: number) => set({ size: s === defaultSize ? undefined : s }, { resetPage: true }),
    [set, defaultSize],
  );
  return { page, size, setPage, setSize };
}

/** `from` / `to` ISO instants in the URL. */
export function useDateRangeParam(): [DateRange, (r: DateRange) => void] {
  const { get, set } = useUrlState();
  const from = get('from');
  const to = get('to');
  const value = useMemo<DateRange>(() => ({ from, to }), [from, to]);
  const onChange = useCallback((r: DateRange) => set({ from: r.from, to: r.to }, { resetPage: true }), [set]);
  return [value, onChange];
}

/** `?focus=<id>` opens a detail drawer. */
export function useFocusParam() {
  const { get, set } = useUrlState();
  const focus = get('focus');
  const open = useCallback((id: string) => set({ focus: id }), [set]);
  const close = useCallback(() => set({ focus: undefined }), [set]);
  return { focus, open, close };
}
