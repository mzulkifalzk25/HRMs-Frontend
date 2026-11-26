// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import type { Role } from '@/features/authentication/types'
import {
  announcementSchema,
  notificationSchema,
} from '@/features/notifications/schemas/notification.schema'
import type { ApiError } from '@/services/api'
import { createHrStore } from './hr-store'
import { setMockViewer } from './mock-session'
import { createNotificationStore, type NotificationStore } from './notification-store'

const ACCOUNTS: Record<Role, string> = {
  hr_admin: 'u-hr-001',
  manager: 'u-mgr-001',
  senior_pm: 'u-spm-001',
  associate_pm: 'u-apm-001',
  team_lead: 'u-tl-001',
  employee: 'u-emp-001',
}
const as = (role: Role) => setMockViewer({ id: ACCOUNTS[role], role })

let nowIso = '2026-11-25T06:00:00Z' // 11:00 PKT, Wednesday
let store: NotificationStore
beforeEach(() => {
  nowIso = '2026-11-25T06:00:00Z'
  store = createNotificationStore({ hr: createHrStore(), now: () => new Date(nowIso) })
  setMockViewer(null)
})

function apiError(fn: () => unknown): ApiError {
  try {
    fn()
  } catch (error) {
    return error as ApiError
  }
  throw new Error('Expected an ApiError')
}

const page = { page: 1, pageSize: 50 }

describe('seeded announcements', () => {
  it('reach their audience as notifications; the town hall only Engineering', () => {
    as('employee') // Engineering
    const mine = store.list(page)
    mine.results.forEach((n) => notificationSchema.parse(n))
    expect(mine.results.map((n) => n.title)).toEqual([
      'Engineering town hall on Friday',
      'Welcome to FormbaxHR',
    ])
    expect(store.unreadCount()).toBe(1)
    as('senior_pm') // Delivery
    expect(store.list(page).results.map((n) => n.title)).toEqual(['Welcome to FormbaxHR'])
    as('hr_admin') // the author is not notified of their own announcement
    expect(store.list(page).count).toBe(0)
  })
})

describe('read state (P6-T02)', () => {
  it('marks one and all as read; others’ notifications are not found', () => {
    as('employee')
    const unread = store.list({ ...page, status: 'unread' }).results[0]
    expect(unread?.read).toBe(false)
    expect(store.markRead(unread?.id ?? '').read).toBe(true)
    expect(store.unreadCount()).toBe(0)
    store.notify({ recipientId: 'u-emp-001', type: 'leave_approved', title: 'Approved' })
    store.notify({ recipientId: 'u-emp-001', type: 'leave_declined', title: 'Declined' })
    expect(store.unreadCount()).toBe(2)
    expect(store.markAllRead()).toBe(2)
    expect(store.unreadCount()).toBe(0)
    as('manager')
    expect(apiError(() => store.markRead(unread?.id ?? '')).status).toBe(404)
  })

  it('filters by type, status and date, and paginates', () => {
    for (let i = 0; i < 12; i += 1)
      store.notify({ recipientId: 'u-mgr-001', type: 'approval_required', title: `Task ${i}` })
    as('manager')
    const first = store.list({ page: 1, pageSize: 5, type: 'approval_required' })
    expect(first).toMatchObject({ count: 12, previous: null, next: '?page=2' })
    expect(store.list({ page: 3, pageSize: 5, type: 'approval_required' }).results).toHaveLength(2)
    expect(store.list({ ...page, from: '2026-11-26' }).count).toBe(0)
    expect(store.list({ ...page, status: 'read' }).results.every((n) => n.read)).toBe(true)
  })

  it('delivers an event once per dedupe key', () => {
    const input = {
      recipientId: 'u-emp-001',
      type: 'attendance_reminder' as const,
      title: 'R',
      dedupeKey: 'k',
    }
    expect(store.notify(input)).not.toBeNull()
    expect(store.notify(input)).toBeNull()
  })
})

describe('preferences (D-093)', () => {
  it('mutes reminders and announcements only; muted types are not delivered', () => {
    as('employee')
    expect(store.updatePreferences({ muted: ['attendance_reminder'] })).toEqual({
      muted: ['attendance_reminder'],
    })
    expect(
      store.notify({ recipientId: 'u-emp-001', type: 'attendance_reminder', title: 'R' }),
    ).toBeNull()
    expect(
      store.notify({ recipientId: 'u-emp-001', type: 'leave_approved', title: 'A' }),
    ).not.toBeNull()
    const error = apiError(() =>
      store.updatePreferences({ muted: ['leave_approved' as 'announcement'] }),
    )
    expect(error.status).toBe(400)
  })
})

describe('reminders', () => {
  it('are delivered from the registered source when the list is read, once', () => {
    store.setReminderSource(() => [
      { kind: 'no_check_in', date: '2026-11-25', dueAt: new Date('2026-11-25T04:15:00Z') },
    ])
    as('employee')
    store.list(page)
    const reminders = store.list({ ...page, type: 'attendance_reminder' }).results
    expect(reminders).toMatchObject([
      { title: 'You have not checked in today', link: '/attendance' },
    ])
  })
})

describe('announcements (P6-T08, D-093)', () => {
  it('HR creates one for teams; it reaches only those teams and can be archived', () => {
    as('manager')
    expect(
      apiError(() =>
        store.createAnnouncement({
          title: 'Hi',
          body: 'Hello all',
          audience: { kind: 'everyone', ids: [] },
          expiresOn: null,
        }),
      ).status,
    ).toBe(403)
    as('hr_admin')
    const created = store.createAnnouncement({
      title: 'Backend team offsite',
      body: 'The backend team meets offsite on Monday.',
      audience: { kind: 'teams', ids: ['t-be'] },
      expiresOn: '2026-11-30',
    })
    announcementSchema.parse(created)
    expect(created.audienceLabel).toBe('Teams: Backend')
    setMockViewer({ id: 'e-105', role: 'employee' }) // Backend team
    expect(store.list(page).results[0]?.title).toBe('Backend team offsite')
    expect(store.listAnnouncements({}).map((a) => a.title)).toContain('Backend team offsite')
    as('employee') // Frontend team
    expect(store.listAnnouncements({}).map((a) => a.title)).not.toContain('Backend team offsite')

    as('hr_admin')
    store.archiveAnnouncement(created.id)
    expect(store.listAnnouncements({}).map((a) => a.id)).not.toContain(created.id)
    expect(
      store.listAnnouncements({ includeInactive: true }).find((a) => a.id === created.id)?.archived,
    ).toBe(true)
    as('employee')
    expect(apiError(() => store.listAnnouncements({ includeInactive: true })).status).toBe(403)
  })

  it('expires after its last day', () => {
    as('employee')
    expect(store.listAnnouncements({}).map((a) => a.title)).toContain(
      'Engineering town hall on Friday',
    )
    nowIso = '2026-12-03T06:00:00Z'
    expect(store.listAnnouncements({}).map((a) => a.title)).not.toContain(
      'Engineering town hall on Friday',
    )
  })

  it.each([
    [{ title: 'Hi' }, 'title'],
    [{ body: 'x' }, 'body'],
    [{ audience: { kind: 'departments' as const, ids: [] } }, 'audience'],
    [{ audience: { kind: 'departments' as const, ids: ['d-ops'] } }, 'audience'], // inactive
    [{ expiresOn: '2026-11-24' }, 'expiresOn'],
  ])('validates %o', (extra, field) => {
    as('hr_admin')
    const error = apiError(() =>
      store.createAnnouncement({
        title: 'Office closed',
        body: 'The office is closed on Friday.',
        audience: { kind: 'everyone', ids: [] },
        expiresOn: null,
        ...extra,
      }),
    )
    expect(error.fieldErrors?.[field]).toBeDefined()
  })

  it('people who muted announcements are not notified, but still see the page', () => {
    as('employee')
    store.updatePreferences({ muted: ['announcement'] })
    as('hr_admin')
    store.createAnnouncement({
      title: 'Office closed',
      body: 'Closed on Friday.',
      audience: { kind: 'everyone', ids: [] },
      expiresOn: null,
    })
    as('employee')
    expect(store.list(page).results.map((n) => n.title)).not.toContain('Office closed')
    expect(store.listAnnouncements({}).map((a) => a.title)).toContain('Office closed')
  })
})
