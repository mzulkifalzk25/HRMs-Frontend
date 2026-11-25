// Date/time helpers in the organization timezone (P1-T12, D-038).
//
// Rules:
// - Every policy decision (Late-In, early checkout, which calendar day a check-in belongs to)
//   uses APP_TIMEZONE, never the browser's timezone. Results are identical on any machine.
// - Timestamps from the API are ISO 8601 with an explicit offset (D5). Strings without an
//   offset are rejected, because the browser would silently read them as local time.
// - Nothing here rounds times. Actual timestamps are preserved (D-056).
// - The backend remains authoritative for attendance calculations (D-028).
import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { z } from 'zod'
import { APP_TIMEZONE, DISPLAY_FORMATS } from '@/constants/app'

/** A point in time: Date, epoch milliseconds, or ISO 8601 string with offset. */
export type Instant = Date | number | string

const isoWithOffset = z.iso.datetime({ offset: true, precision: undefined })
const dateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

export class InvalidInstantError extends Error {
  constructor(value: unknown, reason: string) {
    super(`Invalid instant ${JSON.stringify(value)}: ${reason}`)
    this.name = 'InvalidInstantError'
  }
}

/** Convert an Instant to a Date, rejecting ambiguous or invalid input. */
export function toDate(instant: Instant): Date {
  if (instant instanceof Date) {
    if (Number.isNaN(instant.getTime())) throw new InvalidInstantError(instant, 'invalid Date')
    return new Date(instant.getTime())
  }
  if (typeof instant === 'number') {
    if (!Number.isFinite(instant)) throw new InvalidInstantError(instant, 'not a finite number')
    return new Date(instant)
  }
  if (!isoWithOffset.safeParse(instant).success) {
    throw new InvalidInstantError(
      instant,
      'expected ISO 8601 with an explicit offset (Z or ±HH:MM)',
    )
  }
  return new Date(instant)
}

/** The instant as a TZDate in APP_TIMEZONE (getHours() etc. return Karachi wall-clock values). */
export function toAppZone(instant: Instant): TZDate {
  return new TZDate(toDate(instant).getTime(), APP_TIMEZONE)
}

/** Calendar date in APP_TIMEZONE, as `YYYY-MM-DD` (the day an attendance record belongs to). */
export function appDateKey(instant: Instant): string {
  return format(toAppZone(instant), 'yyyy-MM-dd')
}

/** Wall-clock time in APP_TIMEZONE, as `HH:mm:ss` (24-hour). */
export function appTimeKey(instant: Instant): string {
  return format(toAppZone(instant), 'HH:mm:ss')
}

/**
 * Milliseconds since local midnight in APP_TIMEZONE. Keeps milliseconds so policy code can
 * apply exact boundaries (e.g. 09:15:00.000 vs 09:15:00.001).
 */
export function msSinceAppMidnight(instant: Instant): number {
  const zoned = toAppZone(instant)
  return (
    ((zoned.getHours() * 60 + zoned.getMinutes()) * 60 + zoned.getSeconds()) * 1000 +
    zoned.getMilliseconds()
  )
}

/** UTC offset of APP_TIMEZONE at that instant, as `+05:00`. */
export function appOffset(instant: Instant): string {
  return format(toAppZone(instant), 'xxx')
}

/** ISO 8601 string in APP_TIMEZONE with its offset, e.g. `2026-11-25T09:15:00.000+05:00`. */
export function toAppIsoString(instant: Instant): string {
  return format(toAppZone(instant), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
}

/**
 * The instant at which the APP_TIMEZONE wall clock shows `time` on `dateKey`.
 * Example: `appWallClockToInstant('2026-11-25', '09:15')` → 2026-11-25T04:15:00.000Z.
 */
export function appWallClockToInstant(dateKey: string, time: string): Date {
  const date = dateKeyPattern.exec(dateKey)
  const clock = timePattern.exec(time)
  if (!date || !clock) {
    throw new InvalidInstantError(`${dateKey} ${time}`, 'expected YYYY-MM-DD and HH:mm[:ss]')
  }
  const [, y, m, d] = date
  const [, hh, mm, ss] = clock
  const zoned = new TZDate(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss ?? 0),
    APP_TIMEZONE,
  )
  if (format(zoned, 'yyyy-MM-dd') !== dateKey) {
    throw new InvalidInstantError(dateKey, 'not a real calendar date')
  }
  return new Date(zoned.getTime())
}

/** Display helpers (formats are provisional until Q-TECH-04). */
export function formatAppDate(instant: Instant): string {
  return format(toAppZone(instant), DISPLAY_FORMATS.date)
}

export function formatAppTime(instant: Instant, options: { seconds?: boolean } = {}): string {
  return format(
    toAppZone(instant),
    options.seconds ? DISPLAY_FORMATS.timeWithSeconds : DISPLAY_FORMATS.time,
  )
}

export function formatAppDateTime(instant: Instant): string {
  return format(toAppZone(instant), DISPLAY_FORMATS.dateTime)
}
