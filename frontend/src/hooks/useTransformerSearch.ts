import { useQuery } from '@tanstack/react-query';
import { qk } from './queryKeys';
import { transformerService } from '@/services/transformerService';

/** Quick search for the global search box (top 6 matches). Disabled for empty queries. */
export function useTransformerSearch(q: string, size = 6) {
  const term = q.trim();
  const params = { q: term, size };
  return useQuery({
    queryKey: qk.transformers.list({ ...params, purpose: 'search' }),
    queryFn: () => transformerService.list(params),
    enabled: term.length > 0,
    staleTime: 10_000,
  });
}
