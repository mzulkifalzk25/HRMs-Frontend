// Notification types (P6-T01, D-064, D-093). In-app only. Leave lifecycle and approval-required
// notifications can never be muted; attendance reminders and announcements can.
export const NOTIFICATION_TYPES = [
  'leave_submitted',
  'approval_required',
  'leave_approved',
  'leave_declined',
  'leave_cancelled',
  'attendance_reminder',
  'announcement',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  leave_submitted: 'Leave submitted',
  approval_required: 'Action needed',
  leave_approved: 'Leave approved',
  leave_declined: 'Leave declined',
  leave_cancelled: 'Leave cancelled',
  attendance_reminder: 'Attendance reminder',
  announcement: 'Announcement',
}

/** Types a person may mute in their preferences (D-093). */
export const MUTABLE_NOTIFICATION_TYPES = [
  'attendance_reminder',
  'announcement',
] as const satisfies readonly NotificationType[]
export type MutableNotificationType = (typeof MUTABLE_NOTIFICATION_TYPES)[number]

export function isMutable(type: NotificationType): type is MutableNotificationType {
  return (MUTABLE_NOTIFICATION_TYPES as readonly NotificationType[]).includes(type)
}

/** In-app link for a notification's subject (null when there is nothing to open). */
export function notificationLink(
  subject:
    | { kind: 'leave_request'; id: string }
    | { kind: 'attendance' }
    | { kind: 'announcement'; id: string },
): string {
  switch (subject.kind) {
    case 'leave_request':
      return `/leave/requests/${encodeURIComponent(subject.id)}`
    case 'attendance':
      return '/attendance'
    case 'announcement':
      return `/announcements#${encodeURIComponent(subject.id)}`
  }
}
