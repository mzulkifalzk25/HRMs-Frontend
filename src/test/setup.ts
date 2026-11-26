// Vitest setup: DOM matchers (toBeInTheDocument, toHaveAccessibleName, ...) and
// DOM cleanup between tests (needed because Vitest globals are not enabled).
import '@testing-library/jest-dom/vitest'
import { onlineManager } from '@tanstack/react-query'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { clearAccessToken } from '@/services/auth/access-token'
import { mockAttendanceStore } from '@/services/mock/attendance-store'
import { mockHrStore } from '@/services/mock/hr-store'
import { mockLeaveStore } from '@/services/mock/leave-store'
import { setMockViewer } from '@/services/mock/mock-session'

// jsdom lacks ResizeObserver, which Radix popper-based components (tooltip, dropdown) use
// for positioning. Real browsers have it; a no-op stub is enough for behaviour tests.
if (typeof globalThis.window !== 'undefined' && !('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub
}

afterEach(() => {
  cleanup()
  clearAccessToken() // never let one test's session leak into the next
  setMockViewer(null)
  mockHrStore.reset()
  mockLeaveStore.reset()
  mockAttendanceStore.reset()
  onlineManager.setOnline(true) // an 'offline' event in one test would pause every later query
})
