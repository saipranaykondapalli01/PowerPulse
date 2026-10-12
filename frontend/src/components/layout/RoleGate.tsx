import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types/api';

export interface RoleGateProps {
  roles: Role[];
  children: ReactNode;
  /** Rendered when the user lacks the role (e.g. a read-only view). */
  fallback?: ReactNode;
}

/** Hides UI the current role cannot use. Presentation only — the backend enforces every permission. */
export function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const { hasRole } = useAuth();
  return <>{hasRole(...roles) ? children : fallback}</>;
}
