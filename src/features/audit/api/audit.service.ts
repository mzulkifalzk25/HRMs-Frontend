// AuditService (P8-T17): read-only. HR only (provisional, Q-AUD-01).
import type { Page } from '@/types/api'
import type { AuditEntry, AuditQuery } from '../schemas/audit.schema'

export interface AuditService {
  list(query: AuditQuery, options?: { signal?: AbortSignal }): Promise<Page<AuditEntry>>
  actors(options?: { signal?: AbortSignal }): Promise<Array<{ id: string; name: string }>>
}
