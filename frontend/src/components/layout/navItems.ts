import {
  Bell,
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  Settings,
  Siren,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types/api';

export type NavGroup = 'Overview' | 'Assets' | 'Operations' | 'Insights' | 'System';

export interface NavItem {
  to: string;
  group: NavGroup;
  label: string;
  Icon: LucideIcon;
  /** Mirrors the ProtectedRoute roles in App.tsx. Undefined = everyone. */
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', group: 'Overview', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/grid', group: 'Overview', label: '3D Grid', Icon: Boxes },
  { to: '/transformers', group: 'Assets', label: 'Transformers', Icon: Zap },
  { to: '/alerts', group: 'Operations', label: 'Alerts', Icon: Siren },
  { to: '/maintenance', group: 'Operations', label: 'Maintenance', Icon: ClipboardList },
  { to: '/fault-history', group: 'Operations', label: 'Fault History', Icon: History },
  { to: '/reports', group: 'Insights', label: 'Reports', Icon: BarChart3, roles: ['ADMIN', 'ENGINEER', 'OPERATOR'] },
  { to: '/notifications', group: 'Insights', label: 'Notifications', Icon: Bell },
  { to: '/settings', group: 'System', label: 'Settings', Icon: Settings, roles: ['ADMIN', 'ENGINEER'] },
  { to: '/admin/users', group: 'System', label: 'Administration', Icon: Users, roles: ['ADMIN'] },
];

export const NAV_GROUPS: NavGroup[] = ['Overview', 'Assets', 'Operations', 'Insights', 'System'];

/** Page title for the top bar, derived from the route. */
export function titleForPath(pathname: string): string {
  if (/^\/transformers\/[^/]+/.test(pathname)) return 'Transformer details';
  if (pathname.startsWith('/admin/users')) return 'Administration';
  const item = NAV_ITEMS.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  return item?.label ?? 'PowerPulse';
}

/** Section the current route belongs to (for the top-bar breadcrumb). */
export function groupForPath(pathname: string): NavGroup | null {
  const item = NAV_ITEMS.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  return item?.group ?? null;
}
