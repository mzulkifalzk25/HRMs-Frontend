import { describe, expect, it } from 'vitest'
import { NOTIFICATION_TYPES, isMutable, notificationLink } from './notification-types'

describe('notification types (D-093)', () => {
  it('only reminders and announcements can be muted', () => {
    expect(NOTIFICATION_TYPES.filter(isMutable)).toEqual(['attendance_reminder', 'announcement'])
  })

  it('links each subject to its screen', () => {
    expect(notificationLink({ kind: 'leave_request', id: 'lr-1' })).toBe('/leave/requests/lr-1')
    expect(notificationLink({ kind: 'attendance' })).toBe('/attendance')
    expect(notificationLink({ kind: 'announcement', id: 'an 1' })).toBe('/announcements#an%201')
  })
})
