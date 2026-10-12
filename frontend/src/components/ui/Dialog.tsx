import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { IconButton } from './IconButton';
import { useFocusTrap } from './useFocusTrap';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Footer slot (actions). Forms usually render their own footer inside children. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Element to focus first instead of the first focusable. */
  initialFocus?: RefObject<HTMLElement>;
  /** Prevent closing by backdrop click (e.g. while submitting). */
  dismissible?: boolean;
}

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

/** Modal dialog: role="dialog", aria-modal, labelled by its title, focus trap, Esc to close, focus restore. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocus,
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, open, () => dismissible && onClose(), initialFocus);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-canvas/80 backdrop-blur-[2px]"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-md border border-line bg-panel text-fg shadow-overlay sm:rounded-md',
          widths[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-xs text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close dialog" icon={<X />} onClick={onClose} size="sm" data-focus-skip />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
