// Dashboard contracts (P2-T12). Types are inferred from these schemas, so the mock and HTTP
// implementations and the screens all share one definition. All counts come from the backend:
// the frontend never derives attendance policy (Late-In, absent) itself (D-028, Q-ATT-02).
import { z } from 'zod'
import {
  dateKeySchema,
  instantSchema,
  leaveStatusSchema,
  leaveTypeSchema,
  todayStatusSchema,
} from '@/types/hr'

const count = z.number().int().nonnegative()

export const attendanceSummarySchema = z.object({
  total: count,
  present: count,
  late: count,
  onLeave: count,
  notCheckedIn: count,
  /** Provisional: the definition of "absent" is still open (Q-ATT-02). */
  absent: count,
})

export const attendanceTrendPointSchema = z.object({
  date: dateKeySchema,
  present: count,
  late: count,
  absent: count,
})

export const departmentStatSchema = z.object({
  id: z.string(),
  name: z.string(),
  headcount: count,
  presentToday: count,
})

export const activityItemSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
  at: instantSchema,
})

export const leaveRequestSummarySchema = z.object({
  id: z.string(),
  employeeName: z.string(),
  leaveType: leaveTypeSchema,
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  /** Requested duration as stated on the request (counting rules are open: Q-LEAVE-04…06). */
  requestedDays: z.number().positive(),
  status: leaveStatusSchema,
  submittedAt: instantSchema,
})

/** A leave request waiting for the signed-in user. `stage` is what they are asked to do. */
export const approvalTaskSchema = z.object({
  id: z.string(),
  employeeName: z.string(),
  leaveType: leaveTypeSchema,
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  requestedDays: z.number().positive(),
  stage: z.enum(['review', 'recommendation', 'final_approval']),
  submittedAt: instantSchema,
})

export const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  designation: z.string(),
  todayStatus: todayStatusSchema,
})

export const projectTeamSchema = z.object({
  id: z.string(),
  projectName: z.string(),
  associatePmName: z.string().nullable(),
  teamSize: count,
  presentToday: count,
  pendingApprovals: count,
})

export const leaveBalanceSchema = z.object({
  leaveType: leaveTypeSchema,
  allocated: z.number().nonnegative(),
  used: z.number().nonnegative(),
  remaining: z.number(),
})

export const notificationPreviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  at: instantSchema,
  read: z.boolean(),
})

export const hrDashboardSchema = z.object({
  metrics: z.object({
    totalEmployees: count,
    presentToday: count,
    absentToday: count,
    lateArrivals: count,
    pendingLeaveRequests: count,
  }),
  departments: z.array(departmentStatSchema),
  attendanceTrend: z.array(attendanceTrendPointSchema),
  recentActivity: z.array(activityItemSchema),
})

export const managerDashboardSchema = z.object({
  teamAttendance: attendanceSummarySchema,
  teamLeaveRequests: z.array(leaveRequestSummarySchema),
  approvalInbox: z.array(approvalTaskSchema),
  team: z.array(teamMemberSchema),
})

export const seniorPmDashboardSchema = z.object({
  projectTeams: z.array(projectTeamSchema),
  pendingApprovals: z.array(approvalTaskSchema),
  teamAttendance: attendanceSummarySchema,
  leaveSummary: z.object({ pending: count, approvedThisMonth: count, onLeaveToday: count }),
})

export const associatePmDashboardSchema = z.object({
  team: z.array(teamMemberSchema),
  teamAttendance: attendanceSummarySchema,
  reviewTasks: z.array(approvalTaskSchema),
})

export const teamLeadDashboardSchema = z.object({
  team: z.array(teamMemberSchema),
  teamAttendance: attendanceSummarySchema,
  reviewTasks: z.array(approvalTaskSchema),
})

export const employeeDashboardSchema = z.object({
  today: z.object({
    date: dateKeySchema,
    status: todayStatusSchema,
    checkInAt: instantSchema.nullable(),
    checkOutAt: instantSchema.nullable(),
  }),
  monthSummary: z.object({ presentDays: count, lateDays: count, leaveDays: count }),
  leaveBalances: z.array(leaveBalanceSchema),
  recentLeaveRequests: z.array(leaveRequestSummarySchema),
  notifications: z.array(notificationPreviewSchema),
  recentActivity: z.array(activityItemSchema),
})

export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>
export type AttendanceTrendPoint = z.infer<typeof attendanceTrendPointSchema>
export type DepartmentStat = z.infer<typeof departmentStatSchema>
export type ActivityItem = z.infer<typeof activityItemSchema>
export type LeaveRequestSummary = z.infer<typeof leaveRequestSummarySchema>
export type ApprovalTask = z.infer<typeof approvalTaskSchema>
export type TeamMember = z.infer<typeof teamMemberSchema>
export type ProjectTeam = z.infer<typeof projectTeamSchema>
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>
export type NotificationPreview = z.infer<typeof notificationPreviewSchema>
export type HrDashboard = z.infer<typeof hrDashboardSchema>
export type ManagerDashboard = z.infer<typeof managerDashboardSchema>
export type SeniorPmDashboard = z.infer<typeof seniorPmDashboardSchema>
export type AssociatePmDashboard = z.infer<typeof associatePmDashboardSchema>
export type TeamLeadDashboard = z.infer<typeof teamLeadDashboardSchema>
export type EmployeeDashboard = z.infer<typeof employeeDashboardSchema>
