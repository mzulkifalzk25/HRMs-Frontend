// Mock report "backend" (P8): computes reports from the other mock stores within the viewer's
// scope (HR all; managers, leads, PMs their scope; employees 403). FICTIONAL data.
import {
  approvedDaysInRange,
  attendanceByDay,
  attendanceByEmployee,
  averageWorkedMs,
  countBy,
  leaveByType,
} from '@/features/reports/lib/report-calc'
import type {
  AttendanceReport,
  DepartmentReport,
  EmployeeReport,
  LeaveReport,
  ReportFilters,
} from '@/features/reports/schemas/report.schema'
import { ROLE_LABELS } from '@/features/authentication/types'
import { appDateKey } from '@/lib/datetime'
import { ApiError } from '@/services/api'
import { LEAVE_TYPES, type LeaveType } from '@/types/hr'
import { mockAttendanceStore, type AttendanceStore } from './attendance-store'
import { mockHrStore, type HrStore } from './hr-store'
import { mockLeaveStore, type LeaveStore } from './leave-store'
import { getMockViewer } from './mock-session'
import { mockSettingsStore } from './settings-store'

const ALL = 100_000

export function createReportStore(
  options: {
    hr?: HrStore
    attendance?: AttendanceStore
    leave?: LeaveStore
    now?: () => Date
  } = {},
) {
  const hr = options.hr ?? mockHrStore
  const attendance = options.attendance ?? mockAttendanceStore
  const leave = options.leave ?? mockLeaveStore
  const now = options.now ?? (() => new Date())

  function viewer() {
    const v = getMockViewer()
    if (!v)
      throw new ApiError({
        status: 401,
        code: 'unauthorized',
        message: 'Your session has expired. Please sign in again.',
      })
    if (v.role === 'employee')
      throw new ApiError({
        status: 403,
        code: 'forbidden',
        message: 'You do not have permission to do this.',
      })
    return v
  }

  /** People in scope that match the filters (active and inactive with history). */
  function people(f: ReportFilters) {
    const v = viewer()
    const scope = hr.visibleEmployeeIds()
    const org = hr.leaveOrg()
    return org.people
      .filter((p) => p.status !== 'invited' && p.id !== v.id && (scope === null || scope.has(p.id)))
      .filter((p) => !f.departmentId || p.departmentId === f.departmentId)
      .filter((p) => !f.teamId || p.teamIds.includes(f.teamId))
      .filter((p) => !f.employeeId || p.id === f.employeeId)
  }

  function records(f: ReportFilters) {
    return attendance.list({
      from: f.from,
      to: f.to,
      page: 1,
      pageSize: ALL,
      departmentId: f.departmentId,
      teamId: f.teamId,
      employeeId: f.employeeId,
    }).results
  }

  function leaves(f: ReportFilters, ids: Set<string>) {
    return leave
      .list({
        page: 1,
        pageSize: ALL,
        from: f.from,
        to: f.to,
        departmentId: f.departmentId,
        employeeId: f.employeeId,
      })
      .results.filter((r) => ids.has(r.employeeId))
  }

  return {
    attendance(f: ReportFilters): AttendanceReport {
      const ps = people(f)
      const ids = new Set(ps.map((p) => p.id))
      const rs = records(f).filter((r) => ids.has(r.employeeId))
      const byEmployee = attendanceByEmployee(ps, rs, appDateKey(now()))
      const names = new Map(ps.map((p) => [p.id, p]))
      return {
        summary: {
          people: ps.length,
          daysRecorded: rs.filter((r) => r.checkInAt).length,
          lateDays: rs.filter((r) => r.checkInStatus === 'late').length,
          incompleteDays: byEmployee.reduce((s, e) => s + e.incompleteDays, 0),
          averageWorkedMs: averageWorkedMs(rs),
        },
        byEmployee,
        byDay: attendanceByDay(rs),
        lateArrivals: rs
          .filter((r) => r.checkInStatus === 'late' && r.checkInAt)
          .map((r) => ({
            employeeId: r.employeeId,
            name: names.get(r.employeeId)?.name ?? r.employeeName,
            departmentName: r.departmentName,
            date: r.date,
            checkInAt: r.checkInAt as string,
          }))
          .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)),
      }
    },

    leave(f: ReportFilters): LeaveReport {
      const v = viewer()
      const ps = people(f)
      const ids = new Set(ps.map((p) => p.id))
      const ls = leaves(f, ids)
      const holidays = mockSettingsStore.holidaySet()
      const year = Number(f.to.slice(0, 4))
      const zero = () =>
        Object.fromEntries(LEAVE_TYPES.map((t) => [t, 0])) as Record<LeaveType, number>
      return {
        byType: leaveByType(ls, f.from, f.to, holidays),
        byEmployee: ps.map((p) => {
          const approvedDays = zero()
          for (const l of ls.filter((x) => x.employeeId === p.id))
            approvedDays[l.leaveType] += approvedDaysInRange(l, f.from, f.to, holidays)
          // Balances are HR information (provisional): others see utilization only.
          const remaining =
            v.role === 'hr_admin' && p.status === 'active'
              ? (Object.fromEntries(
                  LEAVE_TYPES.map((t) => [t, leave.balanceFor(p.id, t, year).remaining]),
                ) as Record<LeaveType, number>)
              : null
          return {
            employeeId: p.id,
            name: p.name,
            departmentName: p.departmentName,
            approvedDays,
            remaining,
          }
        }),
      }
    },

    employees(f: ReportFilters): EmployeeReport {
      const ps = people(f)
      const joining = new Map(hr.attendancePeople().map((p) => [p.id, p.joiningDate]))
      return {
        total: ps.length,
        byDepartment: countBy(ps, (p) => p.departmentName ?? 'No department'),
        byRole: countBy(ps, (p) => ROLE_LABELS[p.role]),
        byStatus: countBy(ps, (p) => (p.status === 'active' ? 'Active' : 'Inactive')),
        joiners: ps
          .map((p) => ({
            employeeId: p.id,
            name: p.name,
            departmentName: p.departmentName,
            joiningDate: joining.get(p.id) ?? '',
          }))
          .filter((p) => p.joiningDate >= f.from && p.joiningDate <= f.to)
          .sort((a, b) => b.joiningDate.localeCompare(a.joiningDate)),
      }
    },

    departments(f: ReportFilters): DepartmentReport {
      const ps = people(f).filter((p) => p.status === 'active')
      const ids = new Set(ps.map((p) => p.id))
      const rs = records(f).filter((r) => ids.has(r.employeeId))
      const ls = leaves(f, ids)
      const holidays = mockSettingsStore.holidaySet()
      const units = hr.orgUnits()
      const teamName = new Map(units.teams.map((t) => [t.id, t.name]))
      return units.departments
        .map((d) => {
          const members = ps.filter((p) => p.departmentId === d.id)
          const memberIds = new Set(members.map((m) => m.id))
          const teams = new Map<string, number>()
          for (const m of members) for (const t of m.teamIds) teams.set(t, (teams.get(t) ?? 0) + 1)
          return {
            departmentId: d.id,
            name: d.name,
            headcount: members.length,
            teams: [...teams].map(([id, c]) => ({ name: teamName.get(id) ?? id, members: c })),
            daysRecorded: rs.filter((r) => memberIds.has(r.employeeId) && r.checkInAt).length,
            lateDays: rs.filter((r) => memberIds.has(r.employeeId) && r.checkInStatus === 'late')
              .length,
            approvedLeaveDays: ls
              .filter((l) => memberIds.has(l.employeeId))
              .reduce((s, l) => s + approvedDaysInRange(l, f.from, f.to, holidays), 0),
          }
        })
        .filter((d) => d.headcount > 0)
    },
  }
}

export type ReportStore = ReturnType<typeof createReportStore>
export const mockReportStore = createReportStore()
