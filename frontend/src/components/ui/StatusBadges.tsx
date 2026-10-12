import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronsUp,
  Circle,
  CircleDot,
  CircleSlash,
  Clock,
  Info,
  Loader,
  Minus,
  OctagonAlert,
  UserCheck,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { AlertStatus, MaintenanceStatus, Priority, Severity, TransformerStatus } from '@/types/api';
import {
  alertStatusLabel,
  maintenanceStatusLabel,
  priorityLabel,
  severityLabel,
  statusLabel,
} from '@/utils/labels';
import { Badge } from './Badge';
import type { Tone } from './tone';

interface Meta {
  tone: Tone;
  Icon: LucideIcon;
}

export const statusMeta: Record<TransformerStatus, Meta> = {
  HEALTHY: { tone: 'healthy', Icon: CheckCircle2 },
  WARNING: { tone: 'warning', Icon: AlertTriangle },
  CRITICAL: { tone: 'critical', Icon: OctagonAlert },
  OFFLINE: { tone: 'offline', Icon: WifiOff },
};

export const severityMeta: Record<Severity, Meta> = {
  LOW: { tone: 'steel', Icon: Info },
  MEDIUM: { tone: 'warning', Icon: AlertTriangle },
  HIGH: { tone: 'critical', Icon: AlertTriangle },
  CRITICAL: { tone: 'critical', Icon: OctagonAlert },
};

export const alertStatusMeta: Record<AlertStatus, Meta> = {
  NEW: { tone: 'accent', Icon: CircleDot },
  ACKNOWLEDGED: { tone: 'steel', Icon: UserCheck },
  IN_PROGRESS: { tone: 'warning', Icon: Loader },
  RESOLVED: { tone: 'healthy', Icon: CheckCircle2 },
};

export const maintenanceStatusMeta: Record<MaintenanceStatus, Meta> = {
  PENDING: { tone: 'neutral', Icon: Circle },
  ASSIGNED: { tone: 'steel', Icon: UserCheck },
  IN_PROGRESS: { tone: 'warning', Icon: Loader },
  COMPLETED: { tone: 'healthy', Icon: CheckCircle2 },
  CANCELLED: { tone: 'offline', Icon: CircleSlash },
};

export const priorityMeta: Record<Priority, Meta> = {
  LOW: { tone: 'neutral', Icon: ArrowDown },
  MEDIUM: { tone: 'steel', Icon: Minus },
  HIGH: { tone: 'warning', Icon: ArrowUp },
  URGENT: { tone: 'critical', Icon: ChevronsUp },
};

function make<T extends string>(meta: Record<T, Meta>, labels: Record<T, string>, kind: string) {
  return function EnumBadge({ value, className }: { value: T; className?: string }) {
    const m = meta[value];
    if (!m) return <Badge className={className}>{String(value)}</Badge>;
    return (
      <Badge tone={m.tone} icon={<m.Icon aria-hidden="true" />} className={className} title={`${kind}: ${labels[value]}`}>
        {labels[value]}
      </Badge>
    );
  };
}

/** Transformer status: icon + text + color (never color alone). */
export const StatusBadge = make(statusMeta, statusLabel, 'Status');
/** Alert severity. */
export const SeverityBadge = make(severityMeta, severityLabel, 'Severity');
/** Alert workflow status. */
export const AlertStatusBadge = make(alertStatusMeta, alertStatusLabel, 'Alert status');
/** Maintenance task status. */
export const MaintenanceStatusBadge = make(maintenanceStatusMeta, maintenanceStatusLabel, 'Task status');
/** Maintenance priority. */
export const PriorityBadge = make(priorityMeta, priorityLabel, 'Priority');

/** "Overdue" marker for maintenance. */
export function OverdueBadge({ className }: { className?: string }) {
  return (
    <Badge tone="critical" icon={<Clock aria-hidden="true" />} className={className}>
      Overdue
    </Badge>
  );
}
