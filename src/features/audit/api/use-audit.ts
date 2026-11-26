import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type { AuditQuery } from '../schemas/audit.schema'

export function useAuditLog(query: AuditQuery) {
  return useQuery({
    queryKey: ['audit', 'list', query],
    queryFn: ({ signal }) => services.audit.list(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAuditActors() {
  return useQuery({
    queryKey: ['audit', 'actors'],
    queryFn: ({ signal }) => services.audit.actors({ signal }),
  })
}
