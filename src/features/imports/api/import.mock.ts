// Mock ImportService backed by the in-memory import store.
import { mockImportStore, type ImportStore } from '@/services/mock/import-store'
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import type { ImportService } from './import.service'

export function createMockImportService(
  options: { latencyMs?: number; store?: ImportStore } = {},
): ImportService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const store = options.store ?? mockImportStore
  const run = async <T>(work: () => T, signal?: AbortSignal): Promise<T> => {
    await simulateLatency(latency, signal)
    return work()
  }
  return {
    create: (type, file) => run(() => store.create(type, { name: file.name, size: file.size })),
    list: ({ signal } = {}) => run(() => store.list(), signal),
    get: (id, { signal } = {}) => run(() => store.get(id), signal),
    rows: (id, { signal } = {}) => run(() => store.rows(id), signal),
    dryRun: (id, input) => run(() => store.dryRun(id, input)),
    execute: (id) => run(() => store.execute(id)),
  }
}
