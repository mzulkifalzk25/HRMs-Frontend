// HTTP AuditService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { z } from 'zod'
import { parseApiResponse, type HttpClient } from '@/services/api'
import { pageSchema } from '@/types/api'
import { auditEntrySchema } from '../schemas/audit.schema'
import type { AuditService } from './audit.service'

export function createHttpAuditService(client: HttpClient): AuditService {
  return {
    async list(q, { signal } = {}) {
      const body = await client.get('audit/', {
        signal,
        query: {
          page: q.page,
          page_size: q.pageSize,
          actor: q.actorId,
          action: q.action,
          entity: q.entity,
          from: q.from,
          to: q.to,
          ordering: q.sort === 'oldest' ? 'at' : '-at',
        },
      })
      return parseApiResponse(pageSchema(auditEntrySchema), body)
    },
    async actors({ signal } = {}) {
      return parseApiResponse(
        z.array(z.object({ id: z.string(), name: z.string() })),
        await client.get('audit/actors/', { signal }),
      )
    },
  }
}
