// Mock AttendanceService backed by the in-memory attendance store.
import { mockAttendanceStore, type AttendanceStore } from '@/services/mock/attendance-store'
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import type { AttendanceService } from './attendance.service'

export function createMockAttendanceService(
  options: { latencyMs?: number; store?: AttendanceStore } = {},
): AttendanceService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const store = options.store ?? mockAttendanceStore
  const run = async <T>(work: () => T, signal?: AbortSignal): Promise<T> => {
    await simulateLatency(latency, signal)
    return work()
  }
  return {
    getToday: ({ signal } = {}) => run(() => store.today(), signal),
    checkIn: () => run(() => store.checkIn()),
    checkOut: () => run(() => store.checkOut()),
    listMine: ({ from, to }, { signal } = {}) => run(() => store.mine(from, to), signal),
    list: (query, { signal } = {}) => run(() => store.list(query), signal),
    get: (id, { signal } = {}) => run(() => store.get(id), signal),
    correct: (id, input) => run(() => store.correct(id, input)),
    listCorrections: (id, { signal } = {}) => run(() => store.corrections(id), signal),
    getSummary: ({ signal } = {}) => run(() => store.summary(), signal),
  }
}
