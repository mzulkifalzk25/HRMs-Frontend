// Public API of the notifications feature (pages are imported directly by the router).
export {
  notificationKeys,
  useAnnouncements,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from './api/use-notifications'
export type { AnnouncementService, NotificationService } from './api/notification.service'
export { NotificationContent } from './components/notification-item'
export type { Announcement, Notification } from './schemas/notification.schema'
