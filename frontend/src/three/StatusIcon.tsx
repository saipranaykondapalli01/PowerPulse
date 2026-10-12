import { CircleCheck, OctagonAlert, PowerOff, TriangleAlert, type LucideProps } from 'lucide-react';
import clsx from 'clsx';
import type { TransformerStatus } from '@/types/api';
import { statusIcon, statusLabel } from './utils';

const ICONS = { CircleCheck, TriangleAlert, OctagonAlert, PowerOff } as const;

export const STATUS_TEXT_CLASS: Record<TransformerStatus, string> = {
  HEALTHY: 'text-healthy',
  WARNING: 'text-warning',
  CRITICAL: 'text-critical',
  OFFLINE: 'text-offline',
};

export const STATUS_BG_CLASS: Record<TransformerStatus, string> = {
  HEALTHY: 'bg-healthy',
  WARNING: 'bg-warning',
  CRITICAL: 'bg-critical',
  OFFLINE: 'bg-offline',
};

export function StatusIcon({ status, ...props }: { status: TransformerStatus } & LucideProps) {
  const Icon = ICONS[statusIcon(status)];
  return <Icon aria-hidden="true" {...props} />;
}

/** Status shown as icon + text, never color alone. */
export function StatusBadge({
  status,
  className,
  size = 'sm',
}: {
  status: TransformerStatus;
  className?: string;
  size?: 'sm' | 'xs';
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-mono uppercase',
        size === 'sm' ? 'text-label' : 'text-[10px] leading-3 tracking-[0.08em]',
        STATUS_TEXT_CLASS[status],
        className,
      )}
    >
      <StatusIcon status={status} size={size === 'sm' ? 13 : 11} strokeWidth={2.25} />
      {statusLabel(status)}
    </span>
  );
}
