import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { UNAUTHORIZED_EVENT } from '@/services/apiClient';
import { qk } from '@/hooks/queryKeys';
import type { Role, UserDto } from '@/types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: UserDto | null;
  status: AuthStatus;
  /** Throws ApiError on failure (401 bad credentials, 429 throttled, …). */
  login: (email: string, password: string) => Promise<UserDto>;
  logout: () => Promise<void>;
  /** True when the current user has one of the roles. UI hint only; the backend enforces. */
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Routes that never trigger the 401 → /login redirect. */
export const PUBLIC_PATHS = ['/', '/login', '/demo'];

export function loginPathFor(pathname: string, search = ''): string {
  return `/login?next=${encodeURIComponent(pathname + search)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const locRef = useRef(location);
  locRef.current = location;

  const me = useQuery({
    queryKey: qk.me,
    queryFn: authService.me,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Prime the XSRF-TOKEN cookie once at boot (best effort; apiClient also lazily ensures it).
  useEffect(() => {
    authService.csrf().catch(() => undefined);
  }, []);

  // Any 401 from the API: drop the session and send the user to /login (except on public pages).
  useEffect(() => {
    const onUnauthorized = () => {
      qc.setQueryData(qk.me, null);
      const { pathname, search } = locRef.current;
      if (PUBLIC_PATHS.includes(pathname)) return;
      navigate(loginPathFor(pathname, search), { replace: true });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [qc, navigate]);

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await authService.login({ email, password });
      // Start the session with a clean cache (no data from a previous user).
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== qk.me[0] });
      qc.setQueryData(qk.me, user);
      return user;
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Even if the server call fails, clear the local session.
    } finally {
      navigate('/login', { replace: true });
      qc.clear();
      qc.setQueryData(qk.me, null);
    }
  }, [qc, navigate]);

  const user = me.data ?? null;
  const status: AuthStatus = me.isPending ? 'loading' : user ? 'authenticated' : 'anonymous';

  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, hasRole }),
    [user, status, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
