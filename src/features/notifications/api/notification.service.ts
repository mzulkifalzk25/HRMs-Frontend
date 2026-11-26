// NotificationService and AnnouncementService contracts (P6-T02, P6-T08). Notifications are
// created by the backend from events (leave lifecycle, approvals, reminders, announcements) and
// resolved to recipients server-side; the app lists them, marks them read and edits preferences.
// In-app only (D-093).
import type { Page } from '@/types/api'
import type {
  Announcement,
  AnnouncementInput,
  Notification,
  NotificationListQuery,
  NotificationPreferences,
} from '../schemas/notification.schema'

type Options = { signal?: AbortSignal }

export interface NotificationService {
  list(query: NotificationListQuery, options?: Options): Promise<Page<Notification>>
  unreadCount(options?: Options): Promise<number>
  markRead(id: string): Promise<Notification>
  /** Returns how many were marked. */
  markAllRead(): Promise<number>
  getPreferences(options?: Options): Promise<NotificationPreferences>
  updatePreferences(preferences: NotificationPreferences): Promise<NotificationPreferences>
}

export interface AnnouncementService {
  /** Active announcements for you; HR may include archived and expired ones. */
  list(query: { includeInactive?: boolean }, options?: Options): Promise<Announcement[]>
  /** HR only; notifies the audience (except people who muted announcements). */
  create(input: AnnouncementInput): Promise<Announcement>
  /** HR only. */
  archive(id: string): Promise<Announcement>
}
