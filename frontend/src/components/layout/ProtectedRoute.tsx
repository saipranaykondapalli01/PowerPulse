import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { loginPathFor, useAuth } from '@/context/AuthContext';
import { ButtonLink } from '@/components/ui/Button';
import { roleLabel } from '@/utils/labels';
import type { Role } from '@/types/api';
import { RouteFallback } from './RouteFallback';

/** In-shell 403 state. */
export function NotPermitted({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <ShieldX aria-hidden="true" className="h-8 w-8 text-critical" />
      <p className="font-mono text-label uppercase text-fg-muted">403 · Not permitted</p>
      <h1 className="font-display text-xl font-semibold text-fg">You don’t have access to this page</h1>
      <p className="max-w-md text-sm text-fg-muted">
        {user ? `Signed in as ${roleLabel[user.role]}. ` : ''}
        {roles?.length ? `This area is available to: ${roles.map((r) => roleLabel[r]).join(', ')}.` : ''} Ask an
        administrator if you need access.
      </p>
      <ButtonLink to="/dashboard" variant="secondary" arrow className="mt-2">
        Back to dashboard
      </ButtonLink>
    </div>
  );
}

/**
 * Route guard. Loading → fallback; anonymous → /login?next=…; wrong role → in-shell 403.
 * UI only; the backend enforces every permission.
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { status, hasRole } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <RouteFallback />;
  if (status === 'anonymous') return <Navigate to={loginPathFor(location.pathname, location.search)} replace />;
  if (roles && roles.length > 0 && !hasRole(...roles)) return <NotPermitted roles={roles} />;
  return <Outlet />;
}
