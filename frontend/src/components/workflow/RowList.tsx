import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { SortState } from '@/components/ui/Table';

export interface RowColumn<T> {
  key: string;
  header: ReactNode;
  /** Plain-text header for the mobile sort select (defaults to header when it is a string). */
  sortLabel?: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right';
  /** Classes for the cell (e.g. mobile grid placement "col-span-2"). */
  className?: string;
  /** Mono label shown above the value below lg, where the header row is hidden. */
  mobileLabel?: string;
  /** Marks the cell as the row header. */
  rowHeader?: boolean;
}

export type RowRail = 'critical' | 'warning' | 'accent';

export interface RowListProps<T> {
  /** Accessible name of the table. */
  caption: string;
  columns: RowColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** lg+ grid template, a literal Tailwind class such as "lg:grid-cols-[8rem_minmax(0,2fr)_1fr]". */
  gridClassName: string;
  sort?: SortState | null;
  onSortChange?: (next: SortState) => void;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  /** Restrained left rail (e.g. critical rows). Never the only signal — pair with a text badge. */
  rail?: (row: T) => RowRail | undefined;
  selectedId?: string;
  empty?: ReactNode;
  /** Dims rows while a background fetch updates them. */
  updating?: boolean;
  className?: string;
}

const railClass: Record<RowRail, string> = {
  critical: 'before:bg-critical',
  warning: 'before:bg-warning',
  accent: 'before:bg-accent',
};

/**
 * Responsive data list with table semantics (role=table/row/cell, aria-sort).
 * One DOM for every width: an aligned grid with a sortable header row on lg+, stacked rows with
 * inline labels and a sort select below lg. Rows activate with click, Enter or Space.
 */
export function RowList<T>({
  caption,
  columns,
  rows,
  getRowId,
  gridClassName,
  sort,
  onSortChange,
  onRowClick,
  rowLabel,
  rail,
  selectedId,
  empty,
  updating,
  className,
}: RowListProps<T>) {
  const sortId = useId();
  const sortable = columns.filter((c) => c.sortable);

  const toggle = (key: string) => {
    if (!onSortChange) return;
    const dir = sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, dir });
  };

  const onRowKey = (e: KeyboardEvent<HTMLDivElement>, row: T) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  const label = (c: RowColumn<T>) => c.sortLabel ?? (typeof c.header === 'string' ? c.header : c.key);

  return (
    <div className={clsx('min-w-0', className)}>
      {onSortChange && sortable.length > 0 && (
        <div className="flex items-center justify-end gap-2 border-b border-line px-4 py-2 lg:hidden">
          <label htmlFor={sortId} className="font-mono text-label uppercase text-fg-muted">
            Sort by
          </label>
          <div className="relative">
            <select
              id={sortId}
              value={sort ? `${sort.key}:${sort.dir}` : ''}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':');
                if (key) onSortChange({ key, dir: dir === 'asc' ? 'asc' : 'desc' });
              }}
              className="h-8 appearance-none rounded-sm border border-line bg-canvas pl-2 pr-7 text-xs text-fg [&>option]:bg-panel"
            >
              {!sort && <option value="">Default</option>}
              {sortable.flatMap((c) => [
                <option key={`${c.key}:desc`} value={`${c.key}:desc`}>
                  {label(c)} · descending
                </option>,
                <option key={`${c.key}:asc`} value={`${c.key}:asc`}>
                  {label(c)} · ascending
                </option>,
              ])}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
          </div>
        </div>
      )}

      <div role="table" aria-label={caption} aria-busy={updating || undefined}>
        <div role="rowgroup" className="hidden border-b border-line bg-raised/40 lg:block">
          <div role="row" className={clsx('grid items-center gap-x-4 px-4 py-2', gridClassName)}>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              const ariaSort = col.sortable ? (active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined;
              return (
                <div
                  key={col.key}
                  role="columnheader"
                  aria-sort={ariaSort}
                  className={clsx(
                    'min-w-0 whitespace-nowrap font-mono text-label uppercase text-fg-muted',
                    col.align === 'right' && 'text-right',
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggle(col.key)}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-sm uppercase transition-colors duration-fast hover:text-fg',
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
                </div>
              );
            })}
          </div>
        </div>

        <div
          role="rowgroup"
          className={clsx('transition-opacity duration-fast motion-reduce:transition-none', updating && 'opacity-60')}
        >
          {rows.length === 0 && empty
            ? empty
            : rows.map((row) => {
                const id = getRowId(row);
                const r = rail?.(row);
                return (
                  <div
                    key={id}
                    role="row"
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                    aria-current={selectedId === id ? 'true' : undefined}
                    onClick={
                      onRowClick
                        ? (e) => {
                            if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                    onKeyDown={onRowClick ? (e) => onRowKey(e, row) : undefined}
                    className={clsx(
                      'relative grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-line/80 px-4 py-3 last:border-b-0 lg:items-center lg:gap-y-0',
                      gridClassName,
                      'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
                      r ? railClass[r] : 'before:bg-transparent',
                      onRowClick &&
                        'cursor-pointer transition-colors duration-fast hover:bg-raised/50 focus-visible:bg-raised/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-fg/40 motion-reduce:transition-none',
                      selectedId === id && 'bg-raised/60',
                    )}
                  >
                    {columns.map((col) => (
                      <div
                        key={col.key}
                        role={col.rowHeader ? 'rowheader' : 'cell'}
                        className={clsx('min-w-0', col.align === 'right' && 'lg:text-right', col.className)}
                      >
                        {col.mobileLabel && (
                          <span className="mb-0.5 block font-mono text-label uppercase text-fg-muted lg:hidden">{col.mobileLabel}</span>
                        )}
                        {col.cell(row)}
                      </div>
                    ))}
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
