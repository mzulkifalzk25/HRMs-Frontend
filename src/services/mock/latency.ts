// Shared mock infrastructure: simulated network latency (abortable), so mock mode
// exercises the same loading and cancellation paths as real requests.
import { ApiError } from '@/services/api'

// 0 under Vitest: loading states are tested with explicitly slow fakes, flows stay fast.
export const DEFAULT_MOCK_LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 300

export function simulateLatency(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abortError = () =>
      new ApiError({ status: 0, code: 'aborted', message: 'The request was cancelled.' })
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
