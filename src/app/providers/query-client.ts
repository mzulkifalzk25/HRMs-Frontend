// TanStack Query defaults (P1-T13).
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/services/api'

export const MAX_QUERY_RETRIES = 2

/**
 * Retry only failures that can succeed on a second try (network, timeout, 429, 5xx).
 * 4xx errors (validation, permission, not found) and cancellations are never retried.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false
  if (error instanceof ApiError) return error.isRetryable
  return false
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: 30_000,
      },
      mutations: {
        // Mutations (approve, check in, import) are never retried automatically: a retry could
        // duplicate an effect. The backend must still be idempotent (R-013).
        retry: false,
      },
    },
  })
}
