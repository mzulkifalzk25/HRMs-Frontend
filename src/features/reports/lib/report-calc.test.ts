import { describe, expect, it } from 'vitest'
import {
  approvedDaysInRange,
  attendanceByDay,
  attendanceByEmployee,
  averageWorkedMs,
  leaveByType,
} from './report-calc'

const rec = (employeeId: string, date: string, status: 'on_time' | 'late', out = true) => ({
  employeeId,
  date,
  checkInAt: `${date}T09:00:00.000+05:00`,
  checkOutAt: out ? `${date}T18:00:00.000+05:00` : null,
  checkInStatus: status,
  durationMs: out ? 9 * 3_600_000 : null,
})

describe('report aggregation', () => {
  const people = [{ id: 'a', name: 'A', departmentId: 'd', departmentName: 'D' }]
  const records = [
    rec('a', '2026-11-23', 'on_time'),
    rec('a', '2026-11-24', 'late', false),
    rec('a', '2026-11-25', 'late', false),
  ]

  it('counts Late-In from the backend classification and open past days only as incomplete', () => {
    expect(attendanceByEmployee(people, records, '2026-11-25')).toEqual([
      {
        employeeId: 'a',
        name: 'A',
        departmentName: 'D',
        daysPresent: 3,
        lateDays: 2,
        incompleteDays: 1,
        workedMs: 9 * 3_600_000,
      },
    ])
    expect(attendanceByDay(records).map((d) => d.late)).toEqual([0, 1, 1])
    expect(averageWorkedMs(records)).toBe(9 * 3_600_000)
  })

  it('counts approved leave working days inside the range, skipping weekends and holidays', () => {
    const leave = {
      employeeId: 'a',
      leaveType: 'annual' as const,
      startDate: '2026-11-20',
      endDate: '2026-11-26',
      status: 'approved',
    }
    expect(approvedDaysInRange(leave, '2026-11-23', '2026-11-30')).toBe(4) // Mon–Thu
    expect(approvedDaysInRange(leave, '2026-11-23', '2026-11-30', new Set(['2026-11-25']))).toBe(3)
    expect(approvedDaysInRange({ ...leave, status: 'pending' }, '2026-11-01', '2026-11-30')).toBe(0)
    const byType = leaveByType(
      [leave, { ...leave, status: 'declined' }],
      '2026-11-01',
      '2026-11-30',
    )
    expect(byType.find((t) => t.leaveType === 'annual')).toMatchObject({
      approvedDays: 5,
      declined: 1,
    })
  })
})
