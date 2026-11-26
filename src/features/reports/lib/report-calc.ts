// Report aggregation (P8). Pure: works on records that already carry backend classifications
// (Late-In from the Phase 4 policy, exact durations), so no policy logic is duplicated here.
import { leaveDates } from '@/features/leave/lib/duration'
import type { LeaveType } from '@/types/hr'
import { LEAVE_TYPES } from '@/types/hr'

export type ReportPerson = {
  id: string
  name: string
  departmentId: string | null
  departmentName: string | null
}
export type ReportAttendance = {
  employeeId: string
  date: string
  checkInAt: string | null
  checkOutAt: string | null
  checkInStatus: 'early' | 'on_time' | 'late' | null
  durationMs: number | null
}
export type ReportLeave = {
  employeeId: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  status: string
}

export function attendanceByEmployee(
  people: readonly ReportPerson[],
  records: readonly ReportAttendance[],
  today: string,
) {
  return people.map((p) => {
    const mine = records.filter((r) => r.employeeId === p.id && r.checkInAt)
    return {
      employeeId: p.id,
      name: p.name,
      departmentName: p.departmentName,
      daysPresent: mine.length,
      lateDays: mine.filter((r) => r.checkInStatus === 'late').length,
      incompleteDays: mine.filter((r) => !r.checkOutAt && r.date < today).length,
      workedMs: mine.reduce((sum, r) => sum + (r.durationMs ?? 0), 0),
    }
  })
}

export function attendanceByDay(records: readonly ReportAttendance[]) {
  const days = new Map<string, { date: string; present: number; late: number }>()
  for (const r of records) {
    if (!r.checkInAt) continue
    const d = days.get(r.date) ?? { date: r.date, present: 0, late: 0 }
    d.present += 1
    if (r.checkInStatus === 'late') d.late += 1
    days.set(r.date, d)
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function averageWorkedMs(records: readonly ReportAttendance[]): number {
  const done = records.filter((r) => r.durationMs != null)
  return done.length === 0
    ? 0
    : Math.round(done.reduce((s, r) => s + (r.durationMs ?? 0), 0) / done.length)
}

/** Approved leave working days that fall inside [from, to] (D-088 counting, holidays excluded). */
export function approvedDaysInRange(
  leave: ReportLeave,
  from: string,
  to: string,
  holidays: ReadonlySet<string> = new Set(),
) {
  if (leave.status !== 'approved') return 0
  return leaveDates(leave.startDate, leave.endDate, holidays).filter((d) => d >= from && d <= to)
    .length
}

export function leaveByType(
  leaves: readonly ReportLeave[],
  from: string,
  to: string,
  holidays?: ReadonlySet<string>,
) {
  return LEAVE_TYPES.map((leaveType) => {
    const of = leaves.filter((l) => l.leaveType === leaveType)
    return {
      leaveType,
      approvedDays: of.reduce((s, l) => s + approvedDaysInRange(l, from, to, holidays), 0),
      pending: of.filter((l) =>
        ['pending', 'under_review', 'pending_final_approval'].includes(l.status),
      ).length,
      declined: of.filter((l) => l.status === 'declined').length,
      cancelled: of.filter((l) => l.status === 'cancelled').length,
    }
  })
}

export function countBy<T>(items: readonly T[], label: (item: T) => string) {
  const map = new Map<string, number>()
  for (const item of items) map.set(label(item), (map.get(label(item)) ?? 0) + 1)
  return [...map]
    .map(([l, c]) => ({ label: l, count: c }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
