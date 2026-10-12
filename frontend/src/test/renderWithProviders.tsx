import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Role, UserDto } from '@/types/api';

export function makeUser(role: Role = 'ENGINEER', over: Partial<UserDto> = {}): UserDto {
  return {
    id: `u-${role.toLowerCase()}`,
    name: `Test ${role}`,
    email: `${role.toLowerCase()}@test.local`,
    role,
    region: null,
    active: true,
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/** Renders the current pathname+search for navigation assertions. */
export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

interface Options {
  route?: string;
  /** Route pattern for `ui` (e.g. "/transformers/:id"). Default "*". */
  path?: string;
  /** Extra routes rendered alongside. */
  extraRoutes?: ReactNode;
  /** Wrap with AuthProvider (requires authService to be mocked). Default true. */
  withAuth?: boolean;
  queryClient?: QueryClient;
}

export function renderWithProviders(ui: ReactElement, opts: Options = {}) {
  const { route = '/', path = '*', extraRoutes, withAuth = true } = opts;
  const queryClient = opts.queryClient ?? createTestQueryClient();
  const routes = (
    <>
      <Routes>
        <Route path={path} element={ui} />
        {extraRoutes}
      </Routes>
      <LocationProbe />
    </>
  );
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>{withAuth ? <AuthProvider>{routes}</AuthProvider> : routes}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}
