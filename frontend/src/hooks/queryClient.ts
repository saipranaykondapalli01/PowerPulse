import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/services/apiClient';

/** Refetch interval for live monitoring views (dashboard, registry, grid, alerts). */
export const POLL_MS = 10_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      // Never retry auth/permission/validation failures; retry transient errors twice.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
});
