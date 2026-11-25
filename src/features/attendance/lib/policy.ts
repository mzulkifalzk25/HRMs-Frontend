// Attendance policy (P4-T02). Pure functions in Asia/Karachi (D-050). The backend is authoritative
// (D-028); the frontend uses these to preview and display, and the mock backend uses the same rules.
//
// Confirmed rules (D-051…D-057):
// - Official check-in 09:00 with 15 minutes grace. Up to and including 09:15:00.000 is on time;
//   anything later (09:15:00.001 or 09:15:01) is Late-In. Before 09:00 is early (allowed).
// - Late-In is tracking only: never a payroll or salary effect (no payroll fields exist).
// - Official checkout 18:00; checkout from 17:45 onward has no early-departure penalty.
// - Checkout BEFORE 17:45: policy not decided (Q-ATT-01) → "unclassified", no penalty, no flag logic.
// - Duration = actual checkout − actual check-in. No rounding, no break deduction.
import { APP_TIMEZONE } from '@/constants/app'
import { appDateKey, msSinceAppMidnight, toDate, type Instant } from '@/lib/datetime'

export const ATTENDANCE_POLICY = {
  timezone: APP_TIMEZONE,
  officialCheckIn: '09:00',
  graceMinutes: 15,
  officialCheckOut: '18:00',
  /** Checkout this many minutes before the official time carries no early-departure penalty. */
  checkoutAllowanceMinutes: 15,
} as const

export type AttendancePolicy = {
  officialCheckIn: string
  graceMinutes: number
  officialCheckOut: string
  checkoutAllowanceMinutes: number
}

export type CheckInStatus = 'early' | 'on_time' | 'late'
/** `before_window` is reported, not judged: its policy is undecided (Q-ATT-01). */
export type CheckOutStatus = 'within_window' | 'before_window'

function minutesToMs(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return ((h ?? 0) * 60 + (m ?? 0)) * 60_000
}

/** Latest on-time check-in, in ms since Karachi midnight (09:15:00.000 by default). */
export function lateThresholdMs(policy: AttendancePolicy = ATTENDANCE_POLICY): number {
  return minutesToMs(policy.officialCheckIn) + policy.graceMinutes * 60_000
}

/** Earliest checkout without early-departure penalty (17:45:00.000 by default). */
export function checkoutWindowStartMs(policy: AttendancePolicy = ATTENDANCE_POLICY): number {
  return minutesToMs(policy.officialCheckOut) - policy.checkoutAllowanceMinutes * 60_000
}

export function classifyCheckIn(
  instant: Instant,
  policy: AttendancePolicy = ATTENDANCE_POLICY,
): CheckInStatus {
  const ms = msSinceAppMidnight(instant)
  if (ms < minutesToMs(policy.officialCheckIn)) return 'early'
  if (ms <= lateThresholdMs(policy)) return 'on_time'
  return 'late'
}

export function classifyCheckOut(
  instant: Instant,
  policy: AttendancePolicy = ATTENDANCE_POLICY,
): CheckOutStatus {
  return msSinceAppMidnight(instant) >= checkoutWindowStartMs(policy)
    ? 'within_window'
    : 'before_window'
}

/** Exact working duration in milliseconds, or null while the session is open. Never rounded. */
export function workingDurationMs(
  checkIn: Instant | null,
  checkOut: Instant | null,
): number | null {
  if (checkIn === null || checkOut === null) return null
  const ms = toDate(checkOut).getTime() - toDate(checkIn).getTime()
  if (ms < 0) throw new RangeError('Checkout is before check-in')
  return ms
}

/** The calendar day (Asia/Karachi) a check-in belongs to. */
export function attendanceDate(instant: Instant): string {
  return appDateKey(instant)
}

export type SessionState = 'not_checked_in' | 'in_progress' | 'complete' | 'incomplete'

/**
 * State of a day's single session (single session per day is provisional, Q-ATT-03).
 * A past day with a check-in but no checkout is `incomplete` (forgotten checkout, Q-ATT-06:
 * flagged only, resolved by an HR correction; nothing is closed automatically).
 */
export function sessionState(
  record: { date: string; checkInAt: string | null; checkOutAt: string | null },
  today: string,
): SessionState {
  if (!record.checkInAt) return 'not_checked_in'
  if (record.checkOutAt) return 'complete'
  return record.date < today ? 'incomplete' : 'in_progress'
}

/** `8h 05m 30s` — exact to the second, never rounded up. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}
