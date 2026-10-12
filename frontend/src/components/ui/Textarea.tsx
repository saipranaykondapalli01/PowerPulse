import { forwardRef, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { controlClasses, useControlProps } from './Input';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  const a11y = useControlProps(props);
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      {...a11y}
      className={clsx(controlClasses, 'py-2 leading-relaxed', className)}
    />
  );
});
