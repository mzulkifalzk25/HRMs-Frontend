import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import { mockSettingsStore, type SettingsStore } from '@/services/mock/settings-store'
import type { SettingsService } from './settings.service'

export function createMockSettingsService(
  options: { latencyMs?: number; store?: SettingsStore } = {},
): SettingsService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const store = options.store ?? mockSettingsStore
  const run = async <T>(work: () => T, signal?: AbortSignal) => {
    await simulateLatency(latency, signal)
    return work()
  }
  return {
    get: ({ signal } = {}) => run(() => store.get(), signal),
    updateCompany: (input) => run(() => store.updateCompany(input)),
    updateAllocation: (input) => run(() => store.updateAllocation(input)),
    updateApprovals: (input) => run(() => store.updateApprovals(input)),
    addHoliday: (input) => run(() => store.addHoliday(input)),
    removeHoliday: (id) => run(() => store.removeHoliday(id)),
  }
}
