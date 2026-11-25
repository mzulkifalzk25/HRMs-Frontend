// Mock DashboardService (P2-T12). FICTIONAL data (D-073): people are first names with an initial,
// and every figure is invented. Dates are generated relative to "today" in Asia/Karachi so the
// dashboards always look current. Statuses such as "late" or "absent" are supplied as data, the
// way the backend will send them; the mock does not apply attendance policy (D-028, Q-ATT-02).
import { ANNUAL_LEAVE_ALLOWANCE, LEAVE_TYPES } from '@/types/hr'
import { appDateKey, appWallClockToInstant, shiftDateKey, toAppIsoString } from '@/lib/datetime'
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import type {
  ActivityItem,
  ApprovalTask,
  AttendanceSummary,
  EmployeeDashboard,
  HrDashboard,
  LeaveRequestSummary,
  TeamMember,
} from '../schemas/dashboard.schema'
import type { DashboardService } from './dashboard.service'

type Clock = () => Date

function at(dateKey: string, time: string): string {
  return toAppIsoString(appWallClockToInstant(dateKey, time))
}

const ENGINEERING_TEAM: TeamMember[] = [
  { id: 'e-101', name: 'Ali D.', designation: 'Software Engineer', todayStatus: 'present' },
  { id: 'e-102', name: 'Hamza K.', designation: 'Software Engineer', todayStatus: 'late' },
  { id: 'e-103', name: 'Mariam S.', designation: 'QA Engineer', todayStatus: 'present' },
  { id: 'e-104', name: 'Bilal R.', designation: 'Frontend Engineer', todayStatus: 'on_leave' },
  { id: 'e-105', name: 'Hina T.', designation: 'Backend Engineer', todayStatus: 'not_checked_in' },
  { id: 'e-106', name: 'Omar F.', designation: 'DevOps Engineer', todayStatus: 'present' },
]

function summarize(team: TeamMember[]): AttendanceSummary {
  const countOf = (status: TeamMember['todayStatus']) =>
    team.filter((m) => m.todayStatus === status).length
  return {
    total: team.length,
    present: countOf('present'),
    late: countOf('late'),
    onLeave: countOf('on_leave'),
    notCheckedIn: countOf('not_checked_in'),
    absent: countOf('absent'),
  }
}

function approvalTasks(today: string, stage: ApprovalTask['stage']): ApprovalTask[] {
  return [
    {
      id: `apr-${stage}-1`,
      employeeName: 'Hamza K.',
      leaveType: 'casual',
      startDate: shiftDateKey(today, 3),
      endDate: shiftDateKey(today, 3),
      requestedDays: 1,
      stage,
      submittedAt: at(shiftDateKey(today, -1), '16:20'),
    },
    {
      id: `apr-${stage}-2`,
      employeeName: 'Mariam S.',
      leaveType: 'annual',
      startDate: shiftDateKey(today, 10),
      endDate: shiftDateKey(today, 12),
      requestedDays: 3,
      stage,
      submittedAt: at(today, '10:05'),
    },
  ]
}

function leaveRequests(today: string, employeeName: string): LeaveRequestSummary[] {
  return [
    {
      id: 'lr-1',
      employeeName,
      leaveType: 'medical_sick',
      startDate: shiftDateKey(today, -20),
      endDate: shiftDateKey(today, -19),
      requestedDays: 2,
      status: 'approved',
      submittedAt: at(shiftDateKey(today, -21), '08:40'),
    },
    {
      id: 'lr-2',
      employeeName,
      leaveType: 'casual',
      startDate: shiftDateKey(today, 5),
      endDate: shiftDateKey(today, 5),
      requestedDays: 1,
      status: 'under_review',
      submittedAt: at(shiftDateKey(today, -2), '11:15'),
    },
    {
      id: 'lr-3',
      employeeName,
      leaveType: 'annual',
      startDate: shiftDateKey(today, -45),
      endDate: shiftDateKey(today, -43),
      requestedDays: 3,
      status: 'declined',
      submittedAt: at(shiftDateKey(today, -50), '14:00'),
    },
  ]
}

function activity(today: string, items: Array<[string, string, string, string]>): ActivityItem[] {
  return items.map(([actor, action, target, time], index) => ({
    id: `act-${index + 1}`,
    actor,
    action,
    target,
    at: at(today, time),
  }))
}

export function buildMockHrDashboard(today: string): HrDashboard {
  return {
    metrics: {
      totalEmployees: 48,
      presentToday: 39,
      absentToday: 2,
      lateArrivals: 4,
      pendingLeaveRequests: 6,
    },
    departments: [
      { id: 'd-eng', name: 'Engineering', headcount: 22, presentToday: 18 },
      { id: 'd-del', name: 'Delivery', headcount: 9, presentToday: 8 },
      { id: 'd-des', name: 'Design', headcount: 6, presentToday: 5 },
      { id: 'd-hr', name: 'Human Resources', headcount: 4, presentToday: 4 },
      { id: 'd-fin', name: 'Finance', headcount: 7, presentToday: 4 },
    ],
    attendanceTrend: Array.from({ length: 14 }, (_, index) => {
      const date = shiftDateKey(today, index - 13)
      const wave = [0, 2, 1, 3, 1, 0, 2, 4, 1, 2, 0, 3, 1, 2][index] ?? 0
      return { date, present: 40 - wave, late: 2 + (wave % 3), absent: wave % 2 }
    }),
    recentActivity: activity(today, [
      ['Sana Demo', 'approved leave for', 'Bilal R.', '11:42'],
      ['Sana Demo', 'corrected attendance of', 'Hina T.', '10:15'],
      ['Imran Demo', 'declined leave for', 'Omar F.', '09:58'],
      ['Sana Demo', 'created employee', 'Rabia N.', '09:20'],
    ]),
  }
}

export function buildMockEmployeeDashboard(today: string): EmployeeDashboard {
  const used = { medical_sick: 2, casual: 1, annual: 0 }
  return {
    today: { date: today, status: 'present', checkInAt: at(today, '09:07'), checkOutAt: null },
    monthSummary: { presentDays: 16, lateDays: 1, leaveDays: 2 },
    leaveBalances: LEAVE_TYPES.map((leaveType) => ({
      leaveType,
      allocated: ANNUAL_LEAVE_ALLOWANCE[leaveType],
      used: used[leaveType],
      remaining: ANNUAL_LEAVE_ALLOWANCE[leaveType] - used[leaveType],
    })),
    recentLeaveRequests: leaveRequests(today, 'Ali Demo'),
    notifications: [
      {
        id: 'n-1',
        title: 'Your casual leave request is under review',
        at: at(today, '08:55'),
        read: false,
      },
      {
        id: 'n-2',
        title: 'HR announcement: office closed on the next public holiday',
        at: at(shiftDateKey(today, -1), '17:30'),
        read: true,
      },
    ],
    recentActivity: activity(today, [
      ['Ali Demo', 'checked in', 'Today', '09:07'],
      ['Ali Demo', 'submitted a casual leave request for', shiftDateKey(today, 5), '08:50'],
    ]),
  }
}

export function createMockDashboardService(
  options: { latencyMs?: number; now?: Clock } = {},
): DashboardService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const now = options.now ?? (() => new Date())
  const today = () => appDateKey(now())
  const respond = async <T>(build: () => T, signal?: AbortSignal): Promise<T> => {
    await simulateLatency(latency, signal)
    return build()
  }

  return {
    getHrDashboard: ({ signal } = {}) => respond(() => buildMockHrDashboard(today()), signal),
    getManagerDashboard: ({ signal } = {}) =>
      respond(
        () => ({
          teamAttendance: summarize(ENGINEERING_TEAM),
          teamLeaveRequests: leaveRequests(today(), 'Hamza K.').slice(0, 2),
          approvalInbox: approvalTasks(today(), 'final_approval'),
          team: ENGINEERING_TEAM,
        }),
        signal,
      ),
    getSeniorPmDashboard: ({ signal } = {}) =>
      respond(
        () => ({
          projectTeams: [
            {
              id: 'p-1',
              projectName: 'Payroll Portal Revamp',
              associatePmName: 'Usman Demo',
              teamSize: 7,
              presentToday: 6,
              pendingApprovals: 2,
            },
            {
              id: 'p-2',
              projectName: 'Mobile Attendance App',
              associatePmName: 'Nida P.',
              teamSize: 5,
              presentToday: 5,
              pendingApprovals: 0,
            },
            {
              id: 'p-3',
              projectName: 'Client Onboarding',
              associatePmName: null,
              teamSize: 4,
              presentToday: 3,
              pendingApprovals: 1,
            },
          ],
          pendingApprovals: approvalTasks(today(), 'final_approval').slice(0, 1),
          teamAttendance: {
            total: 16,
            present: 13,
            late: 1,
            onLeave: 1,
            notCheckedIn: 1,
            absent: 0,
          },
          leaveSummary: { pending: 3, approvedThisMonth: 5, onLeaveToday: 1 },
        }),
        signal,
      ),
    getAssociatePmDashboard: ({ signal } = {}) =>
      respond(
        () => ({
          team: ENGINEERING_TEAM.slice(0, 4),
          teamAttendance: summarize(ENGINEERING_TEAM.slice(0, 4)),
          reviewTasks: approvalTasks(today(), 'recommendation'),
        }),
        signal,
      ),
    getTeamLeadDashboard: ({ signal } = {}) =>
      respond(
        () => ({
          team: ENGINEERING_TEAM.slice(2),
          teamAttendance: summarize(ENGINEERING_TEAM.slice(2)),
          reviewTasks: approvalTasks(today(), 'review').slice(1),
        }),
        signal,
      ),
    getEmployeeDashboard: ({ signal } = {}) =>
      respond(() => buildMockEmployeeDashboard(today()), signal),
  }
}
