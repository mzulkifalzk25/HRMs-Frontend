// Exhaustive attendance policy tests (P4 required tests). Instants are given in UTC (Karachi is
// UTC+05:00 in 2026), so results are identical under `pnpm test:timezones` (UTC, LA, Karachi).
import { describe, expect, it } from 'vitest'
import {
  ATTENDANCE_POLICY,
  attendanceDate,
  checkoutWindowStartMs,
  classifyCheckIn,
  classifyCheckOut,
  formatDuration,
  lateThresholdMs,
  sessionState,
  workingDurationMs,
} from './policy'

/** Karachi wall-clock time on 25 Nov 2026 as a UTC ISO string. */
const pkt = (hhmmss: string, ms = 0) => {
  const [h, m, s] = hhmmss.split(':').map(Number)
  return new Date(Date.UTC(2026, 10, 25, (h ?? 0) - 5, m ?? 0, s ?? 0, ms)).toISOString()
}

describe('policy constants (D-050, D-051, D-054)', () => {
  it('matches the confirmed policy', () => {
    expect(ATTENDANCE_POLICY).toMatchObject({
      timezone: 'Asia/Karachi',
      officialCheckIn: '09:00',
      graceMinutes: 15,
      officialCheckOut: '18:00',
      checkoutAllowanceMinutes: 15,
    })
    expect(lateThresholdMs()).toBe((9 * 60 + 15) * 60_000)
    expect(checkoutWindowStartMs()).toBe((17 * 60 + 45) * 60_000)
  })
})

describe('classifyCheckIn', () => {
  it.each([
    ['08:00:00', 0, 'early'],
    ['08:59:59', 999, 'early'],
    ['09:00:00', 0, 'on_time'],
    ['09:14:59', 0, 'on_time'],
    ['09:15:00', 0, 'on_time'], // exactly 09:15:00 is NOT late
    ['09:15:00', 1, 'late'], // 09:15:00.001 is late: anything after 09:15:00.000
    ['09:15:01', 0, 'late'],
    ['12:00:00', 0, 'late'],
  ] as const)('%s.%s → %s', (time, ms, expected) => {
    expect(classifyCheckIn(pkt(time, ms))).toBe(expected)
  })

  it('accepts offset strings and Date objects for the same instant', () => {
    expect(classifyCheckIn('2026-11-25T09:15:00+05:00')).toBe('on_time')
    expect(classifyCheckIn(new Date('2026-11-25T04:15:01Z'))).toBe('late')
  })

  it('respects a configured policy (settings, Phase 8)', () => {
    const relaxed = { ...ATTENDANCE_POLICY, graceMinutes: 30 }
    expect(classifyCheckIn(pkt('09:25:00'), relaxed)).toBe('on_time')
  })
})

describe('classifyCheckOut (before 17:45 is unclassified, Q-ATT-01)', () => {
  it.each([
    ['17:44:59', 'before_window'],
    ['17:45:00', 'within_window'],
    ['18:00:00', 'within_window'],
    ['18:30:00', 'within_window'],
    ['13:00:00', 'before_window'],
  ] as const)('%s → %s', (time, expected) => {
    expect(classifyCheckOut(pkt(time))).toBe(expected)
  })
})

describe('workingDurationMs (no rounding, no breaks)', () => {
  it('is the exact difference in milliseconds', () => {
    expect(workingDurationMs(pkt('09:07:13'), pkt('18:02:41'))).toBe(
      ((8 * 60 + 55) * 60 + 28) * 1000,
    )
    expect(workingDurationMs(pkt('09:00:00'), pkt('09:00:00', 1))).toBe(1)
  })

  it('does not round to official times or subtract a lunch break', () => {
    // 08:31 → 17:46 is 9h 15m exactly, not "09:00–18:00 minus a break".
    expect(workingDurationMs(pkt('08:31:00'), pkt('17:46:00'))).toBe((9 * 60 + 15) * 60_000)
  })

  it('is null for an open session and rejects a checkout before check-in', () => {
    expect(workingDurationMs(pkt('09:00:00'), null)).toBeNull()
    expect(workingDurationMs(null, null)).toBeNull()
    expect(() => workingDurationMs(pkt('10:00:00'), pkt('09:00:00'))).toThrow(RangeError)
  })
})

describe('attendanceDate (Karachi day boundary)', () => {
  it('uses the Karachi calendar day', () => {
    expect(attendanceDate('2026-11-25T18:59:59Z')).toBe('2026-11-25') // 23:59:59 PKT
    expect(attendanceDate('2026-11-25T19:00:00Z')).toBe('2026-11-26') // 00:00:00 PKT
  })
})

describe('sessionState (single session per day, provisional Q-ATT-03)', () => {
  const today = '2026-11-25'
  it('distinguishes not started, in progress, complete and incomplete', () => {
    expect(sessionState({ date: today, checkInAt: null, checkOutAt: null }, today)).toBe(
      'not_checked_in',
    )
    expect(sessionState({ date: today, checkInAt: pkt('09:00:00'), checkOutAt: null }, today)).toBe(
      'in_progress',
    )
    expect(
      sessionState({ date: today, checkInAt: pkt('09:00:00'), checkOutAt: pkt('18:00:00') }, today),
    ).toBe('complete')
    // A past day without checkout is incomplete (forgotten checkout; flagged, not auto-closed).
    expect(
      sessionState(
        { date: '2026-11-24', checkInAt: '2026-11-24T04:00:00Z', checkOutAt: null },
        today,
      ),
    ).toBe('incomplete')
  })
})

describe('formatDuration', () => {
  it('shows hours, minutes and seconds exactly, truncating sub-second remainders', () => {
    expect(formatDuration(((8 * 60 + 5) * 60 + 30) * 1000)).toBe('8h 05m 30s')
    expect(formatDuration(59_999)).toBe('0h 00m 59s')
    expect(formatDuration(0)).toBe('0h 00m 00s')
  })
})
