// Reference service contract (P1-T11). Every domain follows this shape:
// one interface + Zod schema here, an HTTP implementation and a mock implementation.
import { z } from 'zod'

export const healthStatusSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  /** Where the answer came from; the UI uses it to label mock data honestly. */
  source: z.enum(['api', 'mock']),
  /** ISO 8601 instant with offset. */
  checkedAt: z.iso.datetime({ offset: true }),
})

export type HealthStatus = z.infer<typeof healthStatusSchema>

export interface HealthService {
  getStatus(options?: { signal?: AbortSignal }): Promise<HealthStatus>
}
