import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 60 s — avoids redundant refetches during
        // tab switches and back-navigation on the fintech dashboard.
        staleTime: 60_000,
        // Keep unused cache entries alive for 5 min (default is 5 min, explicit here).
        gcTime: 5 * 60_000,
        // Two retries with exponential backoff handle transient Supabase cold-starts.
        retry: 2,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),
        // Refetch on window focus to sync data across devices, but only if stale (>60s).
        // This ensures multi-device consistency without excessive requests.
        refetchOnWindowFocus: true,
        // Reconnect refetch is fine — the user was offline and is back.
        refetchOnReconnect: true,
      },
      mutations: {
        // Mutations should not retry — a double-submit on a financial write is dangerous.
        retry: 0,
      },
    },
  });
}
