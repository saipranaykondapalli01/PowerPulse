import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name (also used as tooltip). */
  label: string;
  icon: ReactNode;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary';
}

/** Square icon-only button. Always has an aria-label. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'md', variant = 'ghost', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center rounded-sm transition-colors duration-fast',
        'disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        variant === 'ghost'
          ? 'text-fg-muted hover:bg-raised hover:text-fg'
          : 'border border-line bg-raised text-fg hover:border-fg-muted/60',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
