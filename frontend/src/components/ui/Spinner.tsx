import clsx from 'clsx';

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** Accessible label; when omitted the spinner is decorative (aria-hidden). */
  label?: string;
}

const sizes = { xs: 'h-3 w-3 border', sm: 'h-4 w-4 border-2', md: 'h-5 w-5 border-2', lg: 'h-8 w-8 border-2' };

export function Spinner({ size = 'sm', className, label }: SpinnerProps) {
  const el = (
    <span
      aria-hidden="true"
      className={clsx(
        'inline-block animate-spin rounded-full border-current border-r-transparent motion-reduce:animate-none',
        sizes[size],
        className,
      )}
    />
  );
  if (!label) return el;
  return (
    <span role="status" className="inline-flex items-center gap-2">
      {el}
      <span className="sr-only">{label}</span>
    </span>
  );
}
