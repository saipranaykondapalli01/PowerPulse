import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { LoadingBlock } from './Skeleton';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

export interface QueryStateProps<T> {
  query: Pick<UseQueryResult<T>, 'data' | 'isPending' | 'isError' | 'error' | 'refetch' | 'isRefetching'>;
  /** Returns true when the loaded data should show the empty state. */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  errorTitle?: string;
  children: (data: T) => ReactNode;
}

/**
 * Standard loading → error (with Retry) → empty → content switch for a TanStack query.
 * Keeps showing stale data if a background refetch fails.
 */
export function QueryState<T>({ query, isEmpty, empty, loading, errorTitle, children }: QueryStateProps<T>) {
  if (query.isPending) return <>{loading ?? <LoadingBlock />}</>;
  if (query.isError && query.data === undefined) {
    return (
      <ErrorState
        error={query.error}
        title={errorTitle}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
        compact
      />
    );
  }
  const data = query.data as T;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState title="Nothing to show" compact />}</>;
  return <>{children(data)}</>;
}
