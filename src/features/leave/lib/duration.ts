// Leave duration (P5-T06, D-088): Monday–Friday only, public holidays excluded, whole days.
// Works on calendar date keys (YYYY-MM-DD), so the browser timezone never matters.
import { LEAVE_WORKING_WEEKDAYS } from './leave-policy'

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

function utcDay(dateKey: string): number {
  const match = DATE_KEY.exec(dateKey)
  if (!match) throw new RangeError(`Not a date: ${dateKey}`)
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

const DAY_MS = 86_400_000

/** 0 = Sunday … 6 = Saturday for a calendar date. */
export function weekdayOf(dateKey: string): number {
  return new Date(utcDay(dateKey)).getUTCDay()
}

export function isLeaveWorkingDay(dateKey: string, holidays: ReadonlySet<string> = new Set()) {
  return LEAVE_WORKING_WEEKDAYS.includes(weekdayOf(dateKey)) && !holidays.has(dateKey)
}

/** Every counted day between two dates (inclusive). Empty when end is before start. */
export function leaveDates(
  start: string,
  end: string,
  holidays: ReadonlySet<string> = new Set(),
): string[] {
  const from = utcDay(start)
  const to = utcDay(end)
  const dates: string[] = []
  for (let t = from; t <= to; t += DAY_MS) {
    const key = new Date(t).toISOString().slice(0, 10)
    if (isLeaveWorkingDay(key, holidays)) dates.push(key)
  }
  return dates
}

/** Number of leave days a request uses (D-088). 0 when the range has no working day. */
export function leaveDays(
  start: string,
  end: string,
  holidays: ReadonlySet<string> = new Set(),
): number {
  return leaveDates(start, end, holidays).length
}

/** True when two inclusive date ranges share at least one calendar day. */
export function rangesOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
) {
  return a.start <= b.end && b.start <= a.end
}
