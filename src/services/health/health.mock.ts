// Mock implementation of HealthService. Always reports source "mock" so the UI can label it.
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import type { HealthService } from './health.service'

export function createMockHealthService(
  options: { latencyMs?: number; now?: () => Date } = {},
): HealthService {
  const latencyMs = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const now = options.now ?? (() => new Date())
  return {
    async getStatus({ signal } = {}) {
      await simulateLatency(latencyMs, signal)
      return { status: 'ok', source: 'mock', checkedAt: now().toISOString() }
    },
  }
}
