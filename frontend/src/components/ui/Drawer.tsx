import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { IconButton } from './IconButton';
import { useFocusTrap } from './useFocusTrap';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Visually hide the title (still labels the dialog). */
  hideTitle?: boolean;
  side?: 'left' | 'right';
  /** Tailwind width class, default w-[min(28rem,100vw)]. */
  widthClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Side sheet (modal): focus trap, Esc, aria-modal. Used for detail panes and the mobile nav. */
export function Drawer({ open, onClose, title, hideTitle, side = 'right', widthClass, children, footer }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-canvas/70" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'absolute inset-y-0 flex flex-col border-line bg-panel text-fg shadow-overlay',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          widthClass ?? 'w-[min(28rem,100vw)]',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={titleId} className={clsx('font-display text-sm font-semibold', hideTitle && 'sr-only')}>
            {title}
          </h2>
          <IconButton label="Close" icon={<X />} size="sm" onClick={onClose} className={hideTitle ? 'ml-auto' : undefined} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
