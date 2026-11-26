// One notification (P6-T03, P6-T04): icon per type, title, text, time, unread marker. Every type
// renders with its own icon and label, and links to the related item when there is one.
import {
  AlarmClock,
  Ban,
  CalendarPlus,
  CheckCircle2,
  ListChecks,
  Megaphone,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { formatAppDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from '../lib/notification-types'
import type { Notification } from '../schemas/notification.schema'

const NOTIFICATION_ICONS: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  leave_submitted: { icon: CalendarPlus, className: 'text-info' },
  approval_required: { icon: ListChecks, className: 'text-primary' },
  leave_approved: { icon: CheckCircle2, className: 'text-success' },
  leave_declined: { icon: XCircle, className: 'text-destructive' },
  leave_cancelled: { icon: Ban, className: 'text-muted-foreground' },
  attendance_reminder: { icon: AlarmClock, className: 'text-warning' },
  announcement: { icon: Megaphone, className: 'text-info' },
}

/** The visual content of a notification; the caller decides the wrapper (link, menu item). */
export function NotificationContent({
  notification,
  compact = false,
}: {
  notification: Notification
  compact?: boolean
}) {
  const { icon: Icon, className } = NOTIFICATION_ICONS[notification.type]
  return (
    <span className="flex w-full items-start gap-3 text-left">
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', className)} />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className={cn('block text-sm', notification.read ? '' : 'font-semibold')}>
          {notification.title}
          {notification.read ? null : <span className="sr-only"> (unread)</span>}
        </span>
        {notification.body && !compact ? (
          <span className="block text-sm text-muted-foreground">{notification.body}</span>
        ) : null}
        <span className="block text-xs text-muted-foreground">
          {NOTIFICATION_TYPE_LABELS[notification.type]} ·{' '}
          {formatAppDateTime(notification.createdAt)}
        </span>
      </span>
      {notification.read ? null : (
        <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      )}
    </span>
  )
}
