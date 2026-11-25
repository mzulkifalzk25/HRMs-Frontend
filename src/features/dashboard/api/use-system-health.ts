// Example of the data path every screen uses (D-026):
// component → TanStack Query hook → service interface (from the registry) → mock or HTTP.
import { useQuery } from '@tanstack/react-query'
import type { HealthService } from '@/services/health/health.service'
import { services } from '@/services/registry'

export const systemHealthQueryKey = ['system', 'health'] as const

export function useSystemHealth(health: HealthService = services.health) {
  return useQuery({
    queryKey: systemHealthQueryKey,
    queryFn: ({ signal }) => health.getStatus({ signal }),
  })
}
