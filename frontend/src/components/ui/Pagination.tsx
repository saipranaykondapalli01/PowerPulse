import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { formatNumber } from '@/utils/format';
import { IconButton } from './IconButton';

export interface PaginationProps {
  /** Zero-based page index (Spring style). */
  page: number;
  totalPages: number;
  totalElements: number;
  size: number;
  onPageChange: (page: number) => void;
  /** When provided, shows a page-size select. */
  onSizeChange?: (size: number) => void;
  sizeOptions?: number[];
  className?: string;
  /** Noun for the count, e.g. "transformers". */
  itemLabel?: string;
}

export function Pagination({
  page,
  totalPages,
  totalElements,
  size,
  onPageChange,
  onSizeChange,
  sizeOptions = [10, 20, 50, 100],
  className,
  itemLabel = 'results',
}: PaginationProps) {
  const first = totalElements === 0 ? 0 : page * size + 1;
  const last = Math.min(totalElements, (page + 1) * size);
  const pages = Math.max(1, totalPages);
  return (
    <nav
      aria-label="Pagination"
      className={clsx('flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs text-fg-muted', className)}
    >
      <p aria-live="polite" className="tabular font-mono">
        {formatNumber(first)}–{formatNumber(last)} of {formatNumber(totalElements)} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        {onSizeChange && (
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-label uppercase">Rows</span>
            <select
              value={size}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="h-7 rounded-sm border border-line bg-canvas px-1.5 text-xs text-fg [&>option]:bg-panel"
            >
              {sizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <IconButton
          size="sm"
          variant="secondary"
          label="Previous page"
          icon={<ChevronLeft />}
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="tabular font-mono">
          Page {page + 1} / {pages}
        </span>
        <IconButton
          size="sm"
          variant="secondary"
          label="Next page"
          icon={<ChevronRight />}
          disabled={page >= pages - 1}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  );
}
