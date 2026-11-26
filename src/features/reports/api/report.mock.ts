import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import { mockReportStore, type ReportStore } from '@/services/mock/report-store'
import type { ReportService } from './report.service'

export function createMockReportService(
  options: { latencyMs?: number; store?: ReportStore } = {},
): ReportService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const store = options.store ?? mockReportStore
  const run = async <T>(work: () => T, signal?: AbortSignal) => {
    await simulateLatency(latency, signal)
    return work()
  }
  return {
    attendance: (f, { signal } = {}) => run(() => store.attendance(f), signal),
    leave: (f, { signal } = {}) => run(() => store.leave(f), signal),
    employees: (f, { signal } = {}) => run(() => store.employees(f), signal),
    departments: (f, { signal } = {}) => run(() => store.departments(f), signal),
  }
}
