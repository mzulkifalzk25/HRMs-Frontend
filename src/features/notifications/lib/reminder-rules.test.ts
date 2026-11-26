import { describe, expect, it } from 'vitest'
import { remindersDue, type ReminderInput } from './reminder-rules'

// Wednesday 25 Nov 2026 (Pakistan time).
const at = (iso: string) => new Date(iso)
const input = (extra: Partial<ReminderInput> = {}): ReminderInput => ({
  now: at('2026-11-25T09:15:00+05:00'),
  today: '2026-11-25',
  active: true,
  checkedInToday: false,
  onLeaveToday: false,
  records: [],
  ...extra,
})

describe('attendance reminders (D-093)', () => {
  it('no check-in: due from 9:15 AM Pakistan time, regardless of the device timezone', () => {
    expect(remindersDue(input({ now: at('2026-11-25T09:14:59+05:00') }))).toEqual([])
    expect(remindersDue(input())).toEqual([
      { kind: 'no_check_in', date: '2026-11-25', dueAt: at('2026-11-25T09:15:00+05:00') },
    ])
  })

  it.each([
    ['checked in', { checkedInToday: true }],
    ['on approved leave', { onLeaveToday: true }],
    ['inactive', { active: false }],
    ['a Saturday', { today: '2026-11-28', now: at('2026-11-28T10:00:00+05:00') }],
    ['a Sunday', { today: '2026-11-29', now: at('2026-11-29T10:00:00+05:00') }],
  ])('no check-in reminder when %s', (_label, extra) => {
    expect(remindersDue(input(extra)).filter((r) => r.kind === 'no_check_in')).toEqual([])
  })

  it('missing check-out: the next morning, for recent open days only', () => {
    const records = [
      { date: '2026-11-24', checkInAt: '2026-11-24T09:00:00+05:00', checkOutAt: null },
      {
        date: '2026-11-23',
        checkInAt: '2026-11-23T09:00:00+05:00',
        checkOutAt: '2026-11-23T18:00:00+05:00',
      },
      { date: '2026-11-10', checkInAt: '2026-11-10T09:00:00+05:00', checkOutAt: null }, // too old
      { date: '2026-11-25', checkInAt: '2026-11-25T09:00:00+05:00', checkOutAt: null }, // today
    ]
    const early = remindersDue(
      input({ now: at('2026-11-25T08:59:00+05:00'), checkedInToday: true, records }),
    )
    expect(early).toEqual([])
    const due = remindersDue(
      input({ now: at('2026-11-25T09:00:00+05:00'), checkedInToday: true, records }),
    )
    expect(due).toEqual([
      { kind: 'missing_check_out', date: '2026-11-24', dueAt: at('2026-11-25T09:00:00+05:00') },
    ])
  })
})
