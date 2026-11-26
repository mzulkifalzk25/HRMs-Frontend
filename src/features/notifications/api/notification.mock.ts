// Mock NotificationService / AnnouncementService backed by the in-memory notification store.
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import { mockNotificationStore, type NotificationStore } from '@/services/mock/notification-store'
import type { AnnouncementService, NotificationService } from './notification.service'

type MockOptions = { latencyMs?: number; store?: NotificationStore }

function runner(options: MockOptions) {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  return async <T>(work: () => T, signal?: AbortSignal): Promise<T> => {
    await simulateLatency(latency, signal)
    return work()
  }
}

export function createMockNotificationService(options: MockOptions = {}): NotificationService {
  const store = options.store ?? mockNotificationStore
  const run = runner(options)
  return {
    list: (query, { signal } = {}) => run(() => store.list(query), signal),
    unreadCount: ({ signal } = {}) => run(() => store.unreadCount(), signal),
    markRead: (id) => run(() => store.markRead(id)),
    markAllRead: () => run(() => store.markAllRead()),
    getPreferences: ({ signal } = {}) => run(() => store.getPreferences(), signal),
    updatePreferences: (preferences) => run(() => store.updatePreferences(preferences)),
  }
}

export function createMockAnnouncementService(options: MockOptions = {}): AnnouncementService {
  const store = options.store ?? mockNotificationStore
  const run = runner(options)
  return {
    list: (query, { signal } = {}) => run(() => store.listAnnouncements(query), signal),
    create: (input) => run(() => store.createAnnouncement(input)),
    archive: (id) => run(() => store.archiveAnnouncement(id)),
  }
}
