// TanStack Query hooks for notifications and announcements (P6-T09). The unread count is polled
// every 60 s and refreshed when the window regains focus; no WebSocket transport is introduced
// without a requirement (D-094). Leave actions and check-ins also refresh notifications, because
// they create them.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type {
  AnnouncementInput,
  NotificationListQuery,
  NotificationPreferences,
} from '../schemas/notification.schema'
import type { AnnouncementService, NotificationService } from './notification.service'

export const UNREAD_POLL_MS = 60_000

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (query: NotificationListQuery) => ['notifications', 'list', query] as const,
  unread: ['notifications', 'unread'] as const,
  preferences: ['notifications', 'preferences'] as const,
  announcements: (includeInactive: boolean) =>
    ['notifications', 'announcements', includeInactive] as const,
}

const ntf = (service?: NotificationService) => service ?? services.notifications
const ann = (service?: AnnouncementService) => service ?? services.announcements

export function useNotifications(query: NotificationListQuery, service?: NotificationService) {
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: ({ signal }) => ntf(service).list(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useUnreadCount(service?: NotificationService) {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => ntf(service).unreadCount({ signal }),
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useNotificationPreferences(service?: NotificationService) {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: ({ signal }) => ntf(service).getPreferences({ signal }),
  })
}

export function useAnnouncements(includeInactive = false, service?: AnnouncementService) {
  return useQuery({
    queryKey: notificationKeys.announcements(includeInactive),
    queryFn: ({ signal }) => ann(service).list({ includeInactive }, { signal }),
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: notificationKeys.all })
}

export function useMarkRead(service?: NotificationService) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: (id: string) => ntf(service).markRead(id), onSettled: refresh })
}

export function useMarkAllRead(service?: NotificationService) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: () => ntf(service).markAllRead(), onSettled: refresh })
}

export function useUpdatePreferences(service?: NotificationService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      ntf(service).updatePreferences(preferences),
    onSuccess: refresh,
  })
}

export function useCreateAnnouncement(service?: AnnouncementService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: AnnouncementInput) => ann(service).create(input),
    onSuccess: refresh,
  })
}

export function useArchiveAnnouncement(service?: AnnouncementService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: string) => ann(service).archive(id),
    onSuccess: refresh,
  })
}
