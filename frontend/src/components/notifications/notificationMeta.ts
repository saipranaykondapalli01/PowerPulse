import { CalendarClock, CheckCircle2, Clock, OctagonAlert, UserCheck, WifiOff, type LucideIcon } from 'lucide-react';
import type { NotificationType } from '@/types/api';
import type { Tone } from '@/components/ui/tone';
import { notificationTypeLabel } from '@/utils/labels';

export interface NotificationMeta {
  label: string;
  Icon: LucideIcon;
  tone: Tone;
}

/** Per-type icon, tone and text label. The label always ships with the icon, so type is never color-only. */
export const notificationMeta: Record<NotificationType, NotificationMeta> = {
  NEW_CRITICAL_ALERT: { label: notificationTypeLabel.NEW_CRITICAL_ALERT, Icon: OctagonAlert, tone: 'critical' },
  MAINTENANCE_ASSIGNED: { label: notificationTypeLabel.MAINTENANCE_ASSIGNED, Icon: UserCheck, tone: 'neutral' },
  MAINTENANCE_OVERDUE: { label: notificationTypeLabel.MAINTENANCE_OVERDUE, Icon: Clock, tone: 'warning' },
  UPCOMING_INSPECTION: { label: notificationTypeLabel.UPCOMING_INSPECTION, Icon: CalendarClock, tone: 'neutral' },
  INCIDENT_RESOLVED: { label: notificationTypeLabel.INCIDENT_RESOLVED, Icon: CheckCircle2, tone: 'healthy' },
  TRANSFORMER_OFFLINE: { label: notificationTypeLabel.TRANSFORMER_OFFLINE, Icon: WifiOff, tone: 'offline' },
};

/** "Today", "Yesterday" or a date, for grouping by local calendar day. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
