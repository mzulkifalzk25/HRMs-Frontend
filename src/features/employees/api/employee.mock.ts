// Mock EmployeeService backed by the shared in-memory HR store (services/mock/hr-store.ts).
import { mockHrStore, type HrStore } from '@/services/mock/hr-store'
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import type { EmployeeService } from './employee.service'

export function createMockEmployeeService(
  options: { latencyMs?: number; store?: HrStore } = {},
): EmployeeService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const store = options.store ?? mockHrStore
  const run = async <T>(work: () => T, signal?: AbortSignal): Promise<T> => {
    await simulateLatency(latency, signal)
    return work()
  }
  return {
    list: (query, { signal } = {}) => run(() => store.listEmployees(query), signal),
    get: (id, { signal } = {}) => run(() => store.getEmployee(id), signal),
    create: (input) => run(() => store.createEmployee(input)),
    update: (id, patch) => run(() => store.updateEmployee(id, patch)),
    deactivate: (id, reason) => run(() => store.setEmployeeStatus(id, false, reason)),
    activate: (id) => run(() => store.setEmployeeStatus(id, true)),
  }
}
