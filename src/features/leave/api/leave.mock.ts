// Mock LeaveService / ApprovalService backed by the in-memory leave store.
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import { mockLeaveStore, type LeaveStore } from '@/services/mock/leave-store'
import type { ApprovalService, LeaveService } from './leave.service'

type MockOptions = { latencyMs?: number; store?: LeaveStore }

function runner(options: MockOptions) {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  return async <T>(work: () => T, signal?: AbortSignal): Promise<T> => {
    await simulateLatency(latency, signal)
    return work()
  }
}

export function createMockLeaveService(options: MockOptions = {}): LeaveService {
  const store = options.store ?? mockLeaveStore
  const run = runner(options)
  return {
    getBalances: (query, { signal } = {}) => run(() => store.balances(query), signal),
    getLedger: (query, { signal } = {}) => run(() => store.ledger(query), signal),
    adjustAllocation: (input) => run(() => store.adjustAllocation(input)),
    previewRoute: (managerIds, { signal } = {}) =>
      run(() => store.previewRoute(managerIds), signal),
    listMine: ({ signal } = {}) => run(() => store.mine(), signal),
    submit: (input) =>
      run(() =>
        store.submit({
          ...input,
          attachment: input.attachment
            ? {
                name: input.attachment.name,
                size: input.attachment.size,
                contentType: input.attachment.type,
              }
            : null,
        }),
      ),
    list: (query, { signal } = {}) => run(() => store.list(query), signal),
    get: (id, { signal } = {}) => run(() => store.get(id), signal),
    cancel: (id, input) => run(() => store.cancel(id, input)),
    getSummary: ({ signal } = {}) => run(() => store.summary(), signal),
  }
}

export function createMockApprovalService(options: MockOptions = {}): ApprovalService {
  const store = options.store ?? mockLeaveStore
  const run = runner(options)
  return {
    inbox: (tab, { signal } = {}) => run(() => store.inbox(tab), signal),
    act: (id, input) => run(() => store.act(id, input)),
  }
}
