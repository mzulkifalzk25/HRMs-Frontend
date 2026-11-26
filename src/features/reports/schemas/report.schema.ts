// Report contracts (P8-T01…T10). Computed by the backend within the caller's scope (HR: all;
// managers, leads and PMs: their reporting scope; employees: no reports).
import { z } from 'zod'
import { dateKeySchema, instantSchema, leaveTypeSchema } from '@/types/hr'

const n = z.number().int().nonnegative()

export type ReportFilters = {
  from: string
  to: string
  departmentId?: string
  teamId?: string
  employeeId?: string
}

export const attendanceReportSchema = z.object({
  summary: z.object({
    people: n,
    daysRecorded: n,
    lateDays: n,
    incompleteDays: n,
    /** Average exact worked time of completed days, ms (no rounding, no breaks). */
    averageWorkedMs: n,
  }),
  byEmployee: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      departmentName: z.string().nullable(),
      daysPresent: n,
      lateDays: n,
      incompleteDays: n,
      workedMs: n,
    }),
  ),
  byDay: z.array(z.object({ date: dateKeySchema, present: n, late: n })),
  lateArrivals: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      departmentName: z.string().nullable(),
      date: dateKeySchema,
      checkInAt: instantSchema,
    }),
  ),
})
export type AttendanceReport = z.infer<typeof attendanceReportSchema>

export const leaveReportSchema = z.object({
  byType: z.array(
    z.object({
      leaveType: leaveTypeSchema,
      approvedDays: n,
      pending: n,
      declined: n,
      cancelled: n,
    }),
  ),
  byEmployee: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      departmentName: z.string().nullable(),
      approvedDays: z.record(leaveTypeSchema, n),
      /** Remaining balance per type for the year of `to` (HR only; null otherwise). */
      remaining: z.record(leaveTypeSchema, z.number().int()).nullable(),
    }),
  ),
})
export type LeaveReport = z.infer<typeof leaveReportSchema>

const count = z.object({ label: z.string(), count: n })
export const employeeReportSchema = z.object({
  total: n,
  byDepartment: z.array(count),
  byRole: z.array(count),
  byStatus: z.array(count),
  joiners: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      departmentName: z.string().nullable(),
      joiningDate: dateKeySchema,
    }),
  ),
})
export type EmployeeReport = z.infer<typeof employeeReportSchema>

export const departmentReportSchema = z.array(
  z.object({
    departmentId: z.string(),
    name: z.string(),
    headcount: n,
    teams: z.array(z.object({ name: z.string(), members: n })),
    daysRecorded: n,
    lateDays: n,
    approvedLeaveDays: n,
  }),
)
export type DepartmentReport = z.infer<typeof departmentReportSchema>
