// HTTP implementation of HealthService against the (proposed) Django endpoint GET /health/.
// Contract documented in docs/API_INTEGRATION.md; the backend does not exist yet.
import { z } from 'zod'
import type { HttpClient } from '@/services/api'
import type { HealthService } from './health.service'

const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checked_at: z.iso.datetime({ offset: true }),
})

export function createHttpHealthService(client: HttpClient): HealthService {
  return {
    async getStatus(options = {}) {
      const body = await client.get('health/', {
        schema: healthResponseSchema,
        signal: options.signal,
        auth: false,
      })
      return { status: body.status, source: 'api', checkedAt: body.checked_at }
    },
  }
}
