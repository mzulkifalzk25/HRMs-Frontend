// In-memory notification "backend" for mock mode (P6-T02, P6-T08, D-080). FICTIONAL data.
// Behaves like the server: notifications belong to one recipient (others answer 404), muted types
// are not delivered (D-093), duplicates of the same event are not created twice (dedupe key),
// announcements are HR-only to create or archive (403) and reach their audience (D-093).
// Leave events arrive from the leave store; attendance reminders are produced by a reminder
// source registered by the attendance store (avoids an import cycle).
import {
  audienceLabel,
  isAnnouncementActive,
  reaches,
} from '@/features/notifications/lib/announcement-rules'
import {
  isMutable,
  MUTABLE_NOTIFICATION_TYPES,
  notificationLink,
  type NotificationType,
} from '@/features/notifications/lib/notification-types'
import type { DueReminder } from '@/features/notifications/lib/reminder-rules'
import {
  ANNOUNCEMENT_LIMITS,
  type Announcement,
  type AnnouncementInput,
  type Notification,
  type NotificationListQuery,
  type NotificationPreferences,
} from '@/features/notifications/schemas/notification.schema'
import { appDateKey, formatDateKey, shiftDateKey, toAppIsoString } from '@/lib/datetime'
import { ApiError } from '@/services/api'
import type { Page } from '@/types/api'
import { mockHrStore, type HrStore } from './hr-store'
import { getMockViewer, type MockViewer } from './mock-session'

type Stored = Notification & { recipientId: string; dedupeKey: string | null }
type StoredAnnouncement = Omit<Announcement, 'audienceLabel'>

export type NotifyInput = {
  recipientId: string
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  actorName?: string | null
  /** Event time (ISO with offset); defaults to now. */
  at?: string
  read?: boolean
  /** Same key for the same recipient is delivered once (e.g. one reminder per day). */
  dedupeKey?: string
}

/** Produces the reminders due for a person now (registered by the attendance store). */
export type ReminderSource = (employeeId: string) => DueReminder[]

const err = (
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) => new ApiError({ status, code, message, fieldErrors })

export function createNotificationStore(options: { hr?: HrStore; now?: () => Date } = {}) {
  const hr = options.hr ?? mockHrStore
  const now = options.now ?? (() => new Date())
  let notifications: Stored[] = []
  let announcements: StoredAnnouncement[] = []
  let preferences = new Map<string, NotificationPreferences['muted']>()
  let counter = 0
  let reminderSource: ReminderSource | null = null

  const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`
  const nowIso = () => toAppIsoString(now())
  const today = () => appDateKey(now())

  function viewer(): MockViewer {
    const v = getMockViewer()
    if (!v) throw err(401, 'unauthorized', 'Your session has expired. Please sign in again.')
    return v
  }
  const people = () => hr.leaveOrg().people
  const nameOf = (id: string) => people().find((p) => p.id === id)?.name ?? 'HR'
  const mutedFor = (id: string) => preferences.get(id) ?? []

  function notify(input: NotifyInput): Notification | null {
    if (isMutable(input.type) && mutedFor(input.recipientId).includes(input.type)) return null
    if (
      input.dedupeKey &&
      notifications.some(
        (n) => n.recipientId === input.recipientId && n.dedupeKey === input.dedupeKey,
      )
    ) {
      return null
    }
    const stored: Stored = {
      id: nextId('ntf'),
      recipientId: input.recipientId,
      dedupeKey: input.dedupeKey ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      actorName: input.actorName ?? null,
      createdAt: input.at ?? nowIso(),
      read: input.read ?? false,
    }
    notifications.push(stored)
    return publicView(stored)
  }

  const publicView = ({ recipientId: _r, dedupeKey: _d, ...n }: Stored): Notification => ({ ...n })

  /** Delivers reminders that have become due for this person (the backend schedules them). */
  function deliverReminders(employeeId: string) {
    for (const reminder of reminderSource?.(employeeId) ?? []) {
      notify({
        recipientId: employeeId,
        type: 'attendance_reminder',
        title:
          reminder.kind === 'no_check_in'
            ? 'You have not checked in today'
            : `You did not check out on ${formatDateKey(reminder.date)}`,
        body:
          reminder.kind === 'no_check_in'
            ? 'Check in when you start work. Late-In is recorded for tracking only.'
            : 'Ask HR to correct the record if you worked that day.',
        link: notificationLink({ kind: 'attendance' }),
        at: toAppIsoString(reminder.dueAt),
        dedupeKey: `reminder:${reminder.kind}:${reminder.date}`,
      })
    }
  }

  function mine(v: MockViewer) {
    deliverReminders(v.id)
    return notifications
      .filter((n) => n.recipientId === v.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  }

  function labelled(a: StoredAnnouncement): Announcement {
    const units = hr.orgUnits()
    const names = new Map([...units.departments, ...units.teams].map((u) => [u.id, u.name]))
    return {
      ...a,
      audience: { ...a.audience, ids: [...a.audience.ids] },
      audienceLabel: audienceLabel(a.audience, names),
    }
  }

  function publish(input: AnnouncementInput, authorId: string | null, at: string, read: boolean) {
    const announcement: StoredAnnouncement = {
      id: nextId('ann'),
      title: input.title.trim(),
      body: input.body.trim(),
      audience: { kind: input.audience.kind, ids: [...input.audience.ids] },
      authorName: authorId ? nameOf(authorId) : 'HR',
      createdAt: at,
      expiresOn: input.expiresOn,
      archived: false,
    }
    announcements.push(announcement)
    for (const person of people()) {
      if (person.id === authorId || !reaches(announcement.audience, person)) continue
      notify({
        recipientId: person.id,
        type: 'announcement',
        title: announcement.title,
        body: announcement.body,
        link: notificationLink({ kind: 'announcement', id: announcement.id }),
        actorName: announcement.authorName,
        at,
        read,
      })
    }
    return announcement
  }

  function seed() {
    notifications = []
    announcements = []
    preferences = new Map()
    counter = 0
    const t = today()
    publish(
      {
        title: 'Welcome to FormbaxHR',
        body: 'Attendance, leave and approvals now live in one place. Times are Pakistan time.',
        audience: { kind: 'everyone', ids: [] },
        expiresOn: null,
      },
      'u-hr-001',
      toAppIsoString(new Date(now().getTime() - 3 * 86_400_000)),
      true,
    )
    publish(
      {
        title: 'Engineering town hall on Friday',
        body: 'Join the town hall at 4:00 PM in the main meeting room or online.',
        audience: { kind: 'departments', ids: ['d-eng'] },
        expiresOn: shiftDateKey(t, 7),
      },
      'u-hr-001',
      toAppIsoString(new Date(now().getTime() - 2 * 3_600_000)),
      false,
    )
  }
  seed()

  function validateAnnouncement(input: AnnouncementInput) {
    const errors: Record<string, string[]> = {}
    const { titleMin, titleMax, bodyMin, bodyMax } = ANNOUNCEMENT_LIMITS
    const title = input.title.trim()
    const body = input.body.trim()
    if (title.length < titleMin || title.length > titleMax)
      errors.title = [`Use ${titleMin} to ${titleMax} characters.`]
    if (body.length < bodyMin || body.length > bodyMax)
      errors.body = [`Use ${bodyMin} to ${bodyMax} characters.`]
    if (input.audience.kind !== 'everyone') {
      const units = hr.orgUnits()
      const pool = input.audience.kind === 'departments' ? units.departments : units.teams
      const valid = new Set(pool.filter((u) => u.status === 'active').map((u) => u.id))
      if (input.audience.ids.length === 0) errors.audience = ['Choose at least one.']
      else if (input.audience.ids.some((id) => !valid.has(id)))
        errors.audience = ['Choose active departments or teams.']
    }
    if (input.expiresOn !== null && input.expiresOn < today())
      errors.expiresOn = ['The expiry date cannot be in the past.']
    if (Object.keys(errors).length > 0)
      throw err(400, 'validation_error', 'Some fields are not valid.', errors)
  }

  return {
    reset: seed,
    notify,
    setReminderSource(source: ReminderSource | null) {
      reminderSource = source
    },

    list(query: NotificationListQuery): Page<Notification> {
      const v = viewer()
      let rows = mine(v)
      if (query.type) rows = rows.filter((n) => n.type === query.type)
      if (query.status) rows = rows.filter((n) => n.read === (query.status === 'read'))
      if (query.from) rows = rows.filter((n) => appDateKey(n.createdAt) >= (query.from as string))
      if (query.to) rows = rows.filter((n) => appDateKey(n.createdAt) <= (query.to as string))
      const start = (query.page - 1) * query.pageSize
      return {
        count: rows.length,
        next: start + query.pageSize < rows.length ? `?page=${query.page + 1}` : null,
        previous: query.page > 1 ? `?page=${query.page - 1}` : null,
        results: rows.slice(start, start + query.pageSize).map(publicView),
      }
    },

    unreadCount(): number {
      return mine(viewer()).filter((n) => !n.read).length
    },

    markRead(id: string): Notification {
      const v = viewer()
      const n = notifications.find((x) => x.id === id && x.recipientId === v.id)
      if (!n) throw err(404, 'not_found', 'The requested item was not found.')
      n.read = true
      return publicView(n)
    },

    markAllRead(): number {
      const unread = mine(viewer()).filter((n) => !n.read)
      for (const n of unread) n.read = true
      return unread.length
    },

    getPreferences(): NotificationPreferences {
      return { muted: [...mutedFor(viewer().id)] }
    },

    updatePreferences(next: NotificationPreferences): NotificationPreferences {
      const v = viewer()
      const allowed = new Set<string>(MUTABLE_NOTIFICATION_TYPES)
      if (next.muted.some((t) => !allowed.has(t)))
        throw err(400, 'validation_error', 'Leave and approval notifications cannot be muted.', {
          muted: ['Only reminders and announcements can be muted.'],
        })
      preferences.set(v.id, [...new Set(next.muted)])
      return { muted: [...mutedFor(v.id)] }
    },

    listAnnouncements({ includeInactive = false }: { includeInactive?: boolean }): Announcement[] {
      const v = viewer()
      if (includeInactive && v.role !== 'hr_admin')
        throw err(403, 'forbidden', 'You do not have permission to do this.')
      const person = people().find((p) => p.id === v.id)
      return announcements
        .filter((a) =>
          includeInactive
            ? true
            : isAnnouncementActive(a, today()) &&
              (v.role === 'hr_admin' || (person !== undefined && reaches(a.audience, person))),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(labelled)
    },

    createAnnouncement(input: AnnouncementInput): Announcement {
      const v = viewer()
      if (v.role !== 'hr_admin')
        throw err(403, 'forbidden', 'You do not have permission to do this.')
      validateAnnouncement(input)
      return labelled(publish(input, v.id, nowIso(), false))
    },

    archiveAnnouncement(id: string): Announcement {
      const v = viewer()
      if (v.role !== 'hr_admin')
        throw err(403, 'forbidden', 'You do not have permission to do this.')
      const a = announcements.find((x) => x.id === id)
      if (!a) throw err(404, 'not_found', 'The requested item was not found.')
      a.archived = true
      return labelled(a)
    },
  }
}

export type NotificationStore = ReturnType<typeof createNotificationStore>

/** The shared mock store used by the registry. Tests reset it between cases. */
export const mockNotificationStore = createNotificationStore()
