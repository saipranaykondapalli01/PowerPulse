import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { controlClasses, useControlProps } from './Input';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Native select (best keyboard + mobile support) styled for the dark theme. Pass <option> children. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, ...props }, ref) {
  const a11y = useControlProps(props);
  return (
    <div className={clsx('relative min-w-0', className)}>
      <select
        ref={ref}
        {...props}
        {...a11y}
        className={clsx(controlClasses, 'h-9 cursor-pointer appearance-none pr-8 [&>option]:bg-panel')}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
});
