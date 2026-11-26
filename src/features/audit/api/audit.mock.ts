import { mockAuditStore, type AuditStore } from '@/services/mock/audit-store'
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import type { AuditService } from './audit.service'

export function createMockAuditService(
  options: { latencyMs?: number; store?: AuditStore } = {},
): AuditService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const store = options.store ?? mockAuditStore
  const run = async <T>(work: () => T, signal?: AbortSignal) => {
    await simulateLatency(latency, signal)
    return work()
  }
  return {
    list: (q, { signal } = {}) => run(() => store.list(q), signal),
    actors: ({ signal } = {}) => run(() => store.actors(), signal),
  }
}
