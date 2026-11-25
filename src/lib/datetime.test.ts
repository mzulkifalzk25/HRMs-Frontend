// Run under several process timezones: `pnpm test:timezones` (UTC, America/Los_Angeles,
// Asia/Karachi). Every expectation is fixed, so a pass in all three proves the helpers
// never depend on the machine's timezone.
import { describe, expect, it } from 'vitest'
import { APP_TIMEZONE } from '@/constants/app'
import {
  appDateKey,
  appOffset,
  appTimeKey,
  appWallClockToInstant,
  formatAppDate,
  formatAppDateTime,
  formatAppTime,
  InvalidInstantError,
  msSinceAppMidnight,
  toAppIsoString,
  toDate,
} from './datetime'

const ms = (h: number, m: number, s = 0, milli = 0) => ((h * 60 + m) * 60 + s) * 1000 + milli

describe('APP_TIMEZONE', () => {
  it('is the IANA name for Pakistan', () => {
    expect(APP_TIMEZONE).toBe('Asia/Karachi')
  })
})

describe('toDate', () => {
  it('accepts Date, epoch ms and ISO strings with an offset', () => {
    const expected = Date.UTC(2026, 10, 25, 4, 15, 0)
    expect(toDate(new Date(expected)).getTime()).toBe(expected)
    expect(toDate(expected).getTime()).toBe(expected)
    expect(toDate('2026-11-25T04:15:00Z').getTime()).toBe(expected)
    expect(toDate('2026-11-25T09:15:00+05:00').getTime()).toBe(expected)
    expect(toDate('2026-11-25T09:15:00.000+05:00').getTime()).toBe(expected)
  })

  it.each([
    '2026-11-25T09:15:00', // no offset: would be read as browser-local time
    '2026-11-25',
    '25/11/2026 09:15',
    'not a date',
    '',
  ])('rejects ambiguous or invalid string %j', (value) => {
    expect(() => toDate(value)).toThrow(InvalidInstantError)
  })

  it('rejects invalid Date objects and non-finite numbers', () => {
    expect(() => toDate(new Date('nope'))).toThrow(InvalidInstantError)
    expect(() => toDate(Number.NaN)).toThrow(InvalidInstantError)
    expect(() => toDate(Number.POSITIVE_INFINITY)).toThrow(InvalidInstantError)
  })

  it('returns a copy, never the caller’s Date', () => {
    const original = new Date('2026-11-25T04:15:00Z')
    expect(toDate(original)).not.toBe(original)
  })
})

describe('Karachi wall clock (boundaries used by attendance policy)', () => {
  it.each([
    ['2026-11-25T03:59:59Z', '08:59:59', ms(8, 59, 59)],
    ['2026-11-25T04:00:00Z', '09:00:00', ms(9, 0)],
    ['2026-11-25T04:14:59Z', '09:14:59', ms(9, 14, 59)],
    ['2026-11-25T04:15:00Z', '09:15:00', ms(9, 15)],
    ['2026-11-25T04:15:01Z', '09:15:01', ms(9, 15, 1)],
    ['2026-11-25T12:44:59Z', '17:44:59', ms(17, 44, 59)],
    ['2026-11-25T12:45:00Z', '17:45:00', ms(17, 45)],
    ['2026-11-25T13:00:00Z', '18:00:00', ms(18, 0)],
  ])('%s is %s in Karachi', (iso, time, sinceMidnight) => {
    expect(appTimeKey(iso)).toBe(time)
    expect(msSinceAppMidnight(iso)).toBe(sinceMidnight)
    expect(appDateKey(iso)).toBe('2026-11-25')
  })

  it('keeps milliseconds so 09:15:00.001 is distinguishable from 09:15:00', () => {
    expect(msSinceAppMidnight('2026-11-25T04:15:00.001Z')).toBe(ms(9, 15, 0, 1))
    expect(msSinceAppMidnight('2026-11-25T04:15:00.001Z')).toBeGreaterThan(ms(9, 15))
  })
})

describe('Karachi calendar date near midnight', () => {
  it('assigns instants to the Karachi day, not the UTC or browser day', () => {
    expect(appDateKey('2026-11-25T18:59:59Z')).toBe('2026-11-25') // 23:59:59 PKT
    expect(appDateKey('2026-11-25T19:00:00Z')).toBe('2026-11-26') // 00:00:00 PKT next day
    expect(appDateKey('2026-11-24T19:00:00Z')).toBe('2026-11-25') // still 24th in UTC
  })

  it('handles year boundaries', () => {
    expect(appDateKey('2026-12-31T19:00:00Z')).toBe('2027-01-01')
  })
})

describe('offsets come from IANA rules, not a hardcoded +05:00', () => {
  it('uses +05:00 today', () => {
    expect(appOffset('2026-11-25T04:15:00Z')).toBe('+05:00')
    expect(toAppIsoString('2026-11-25T04:15:00Z')).toBe('2026-11-25T09:15:00.000+05:00')
  })

  it('uses +06:00 during Pakistan’s 2009 daylight saving time', () => {
    expect(appOffset('2009-06-01T03:00:00Z')).toBe('+06:00')
    expect(appWallClockToInstant('2009-06-01', '09:00').toISOString()).toBe(
      '2009-06-01T03:00:00.000Z',
    )
  })
})

describe('appWallClockToInstant', () => {
  it('converts Karachi wall-clock times to instants', () => {
    expect(appWallClockToInstant('2026-11-25', '09:15').toISOString()).toBe(
      '2026-11-25T04:15:00.000Z',
    )
    expect(appWallClockToInstant('2026-11-25', '09:15:01').toISOString()).toBe(
      '2026-11-25T04:15:01.000Z',
    )
    expect(appWallClockToInstant('2026-11-26', '00:00').toISOString()).toBe(
      '2026-11-25T19:00:00.000Z',
    )
  })

  it('round-trips with appDateKey/appTimeKey', () => {
    const instant = appWallClockToInstant('2026-03-01', '17:45:00')
    expect(appDateKey(instant)).toBe('2026-03-01')
    expect(appTimeKey(instant)).toBe('17:45:00')
  })

  it.each([
    ['2026-02-30', '09:00'], // not a real date
    ['2026-13-01', '09:00'],
    ['2026-11-25', '24:00'],
    ['2026-11-25', '9:15'],
    ['25-11-2026', '09:15'],
    ['2026-11-25', '09:60'],
  ])('rejects %s %s', (dateKey, time) => {
    expect(() => appWallClockToInstant(dateKey, time)).toThrow(InvalidInstantError)
  })
})

describe('display formatting (provisional formats, Q-TECH-04)', () => {
  it('formats in Karachi time regardless of the machine timezone', () => {
    expect(formatAppDate('2026-11-25T19:30:00Z')).toBe('26 Nov 2026')
    expect(formatAppTime('2026-11-25T04:15:00Z')).toBe('9:15 AM')
    expect(formatAppTime('2026-11-25T04:15:01Z', { seconds: true })).toBe('9:15:01 AM')
    expect(formatAppTime('2026-11-25T13:00:00Z')).toBe('6:00 PM')
    expect(formatAppDateTime('2026-11-25T04:15:00Z')).toBe('25 Nov 2026, 9:15 AM')
  })

  it('never rounds: 9:14:59 is not shown as 9:15', () => {
    expect(formatAppTime('2026-11-25T04:14:59Z')).toBe('9:14 AM')
  })
})
