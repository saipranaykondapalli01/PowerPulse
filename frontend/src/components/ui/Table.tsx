import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import clsx from 'clsx';

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

export interface Column<T> {
  /** Unique column key; also the sort key when sortable. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Extra classes for th/td (e.g. widths, hidden breakpoints). */
  className?: string;
  /** Make this column's cell the row header (<th scope="row">). */
  rowHeader?: boolean;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Accessible caption (visually hidden unless captionVisible). */
  caption: string;
  captionVisible?: boolean;
  sort?: SortState | null;
  onSortChange?: (next: SortState) => void;
  /** Row activation (click or Enter/Space when focused). Cells with links still work. */
  onRowClick?: (row: T) => void;
  /** Accessible label for row activation, e.g. (row) => `Open ${row.code}`. */
  rowLabel?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  /** Constrain height to enable the sticky header within the scroll container. */
  maxHeight?: string;
  dense?: boolean;
  className?: string;
  /** Shown in place of tbody rows when rows is empty. */
  empty?: ReactNode;
  /** Shows reduced opacity while a background fetch updates rows. */
  updating?: boolean;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' };

/**
 * Data table: sticky header, sortable headers with aria-sort, keyboard-activatable rows.
 * Scrolls horizontally inside its own container so pages never overflow.
 */
export function Table<T>({
  columns,
  rows,
  getRowId,
  caption,
  captionVisible,
  sort,
  onSortChange,
  onRowClick,
  rowLabel,
  rowClassName,
  maxHeight,
  dense,
  className,
  empty,
  updating,
}: TableProps<T>) {
  const toggle = (key: string) => {
    if (!onSortChange) return;
    const dir: SortDir = sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, dir });
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  const cellPad = dense ? 'px-3 py-1.5' : 'px-3 py-2.5';

  return (
    <div
      className={clsx('relative w-full overflow-auto', updating && 'opacity-70 transition-opacity', className)}
      style={maxHeight ? { maxHeight } : undefined}
      aria-busy={updating || undefined}
    >
      <table className="w-full border-collapse text-sm">
        <caption className={clsx(captionVisible ? 'px-3 py-2 text-left text-xs text-fg-muted' : 'sr-only')}>
          {caption}
        </caption>
        <thead className="sticky top-0 z-10 bg-panel">
          <tr className="shadow-[inset_0_-1px_0_rgb(var(--line))]">
            {columns.map((col) => {
              const active = sort?.key === col.key;
              const ariaSort = col.sortable ? (active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={clsx(
                    'whitespace-nowrap font-mono text-label font-normal uppercase text-fg-muted',
                    cellPad,
                    alignClass[col.align ?? 'left'],
                    col.className,
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggle(col.key)}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-sm uppercase hover:text-fg',
                        active && 'text-fg',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {col.header}
                      {active ? (
                        sort!.dir === 'asc' ? (
                          <ArrowUp aria-hidden="true" className="h-3 w-3" />
                        ) : (
                          <ArrowDown aria-hidden="true" className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown aria-hidden="true" className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={getRowId(row)}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                onClick={
                  onRowClick
                    ? (e) => {
                        // Let inner links/buttons handle their own clicks.
                        if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
                        onRowClick(row);
                      }
                    : undefined
                }
                onKeyDown={onRowClick ? (e) => onRowKey(e, row) : undefined}
                className={clsx(
                  'border-b border-line/70 last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-raised/60 focus-visible:bg-raised/60',
                  rowClassName?.(row),
                )}
              >
                {columns.map((col) => {
                  const Tag = col.rowHeader ? 'th' : 'td';
                  return (
                    <Tag
                      key={col.key}
                      scope={col.rowHeader ? 'row' : undefined}
                      className={clsx(
                        'whitespace-nowrap align-middle font-normal text-fg',
                        cellPad,
                        alignClass[col.align ?? 'left'],
                        col.align === 'right' && 'tabular font-mono text-[0.8rem]',
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </Tag>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Client-side sorting for small, fully loaded datasets.
 * `accessors` map a column key to a comparable value (null/undefined always sort last).
 */
export function useClientSort<T>(
  rows: T[] | undefined,
  accessors: Record<string, (row: T) => string | number | null | undefined>,
  initial: SortState | null = null,
) {
  const [sort, setSort] = useState<SortState | null>(initial);
  const sorted = useMemo(() => {
    const list = rows ? [...rows] : [];
    if (!sort) return list;
    const get = accessors[sort.key];
    if (!get) return list;
    const mul = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * mul;
    });
    // accessors is expected to be a stable module-level or memoized object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  return { sorted, sort, setSort };
}
