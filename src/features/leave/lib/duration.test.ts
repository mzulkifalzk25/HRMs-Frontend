import { describe, expect, it } from 'vitest'
import { leaveDates, leaveDays, rangesOverlap, weekdayOf } from './duration'
import { attachmentProblem, LEAVE_ATTACHMENT_RULES, leaveYearOf } from './leave-policy'

describe('leave duration (D-088: Monday–Friday, holidays excluded, whole days)', () => {
  it('knows weekdays of calendar dates regardless of the process timezone', () => {
    expect(weekdayOf('2026-11-23')).toBe(1) // Monday
    expect(weekdayOf('2026-11-28')).toBe(6) // Saturday
    expect(weekdayOf('2026-11-29')).toBe(0) // Sunday
  })

  it.each([
    ['2026-11-23', '2026-11-23', 1], // a Monday
    ['2026-11-23', '2026-11-27', 5], // Monday–Friday
    ['2026-11-27', '2026-11-30', 2], // Friday → Monday skips the weekend
    ['2026-11-28', '2026-11-29', 0], // weekend only
    ['2026-11-23', '2026-12-04', 10], // two weeks
    ['2026-12-31', '2027-01-01', 2], // across a year boundary (validation refuses it elsewhere)
    ['2026-11-27', '2026-11-23', 0], // end before start
  ])('%s → %s counts %i days', (start, end, days) => {
    expect(leaveDays(start, end)).toBe(days)
  })

  it('excludes public holidays supplied by HR', () => {
    const holidays = new Set(['2026-11-25'])
    expect(leaveDays('2026-11-23', '2026-11-27', holidays)).toBe(4)
    expect(leaveDates('2026-11-24', '2026-11-26', holidays)).toEqual(['2026-11-24', '2026-11-26'])
  })

  it('detects overlapping inclusive ranges', () => {
    const a = { start: '2026-11-23', end: '2026-11-25' }
    expect(rangesOverlap(a, { start: '2026-11-25', end: '2026-11-27' })).toBe(true)
    expect(rangesOverlap(a, { start: '2026-11-26', end: '2026-11-27' })).toBe(false)
    expect(rangesOverlap(a, { start: '2026-11-20', end: '2026-11-23' })).toBe(true)
  })

  it('rejects malformed dates', () => {
    expect(() => leaveDays('23/11/2026', '2026-11-24')).toThrow(RangeError)
  })
})

describe('leave policy helpers', () => {
  it('uses the calendar year as the leave year (provisional D-090)', () => {
    expect(leaveYearOf('2026-01-01')).toBe(2026)
    expect(leaveYearOf('2026-12-31')).toBe(2026)
  })

  it.each([
    [{ name: 'note.pdf', type: 'application/pdf', size: 1000 }, null],
    [{ name: 'scan.JPG', type: 'image/jpeg', size: 1000 }, null],
    [{ name: 'photo.png', type: 'image/png', size: LEAVE_ATTACHMENT_RULES.maxBytes }, null],
    [{ name: 'photo.png', type: 'image/png', size: LEAVE_ATTACHMENT_RULES.maxBytes + 1 }, 'size'],
    [{ name: 'doc.docx', type: 'application/msword', size: 10 }, 'type'],
    [{ name: 'fake.pdf.exe', type: 'application/pdf', size: 10 }, 'type'],
    [{ name: 'image.png', type: 'text/html', size: 10 }, 'type'],
  ])('attachment %o → %s (D-088)', (file, problem) => {
    expect(attachmentProblem(file)).toBe(problem)
  })
})
