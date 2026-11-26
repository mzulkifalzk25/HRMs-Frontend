// Every role dashboard renders loading, empty, error and loaded states (P2 required tests).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/features/authentication'
import { ApiError } from '@/services/api'
import { setMockViewer } from '@/services/mock/mock-session'
import { MemoryRouter } from 'react-router'
import { renderWithProviders, withSignedInUser } from '@/test/render'
import type { DashboardService } from '../api/dashboard.service'
import {
  buildMockEmployeeDashboard,
  buildMockHrDashboard,
  createMockDashboardService,
} from '../api/dashboard.mock'
import type {
  AssociatePmDashboard,
  EmployeeDashboard,
  HrDashboard,
  ManagerDashboard,
  SeniorPmDashboard,
  TeamLeadDashboard,
} from '../schemas/dashboard.schema'
import { AssociatePmDashboardPage } from './associate-pm-dashboard-page'
import { EmployeeDashboardPage } from './employee-dashboard-page'
import { HrDashboardPage } from './hr-dashboard-page'
import { ManagerDashboardPage } from './manager-dashboard-page'
import { SeniorPmDashboardPage } from './senior-pm-dashboard-page'
import { TeamLeadDashboardPage } from './team-lead-dashboard-page'

const user: User = {
  id: 'u1',
  email: 'test.user@formbaxhr.test',
  firstName: 'Test',
  lastName: 'Demo',
  role: 'manager',
  employeeCode: null,
  designation: null,
  department: null,
}

const zeroSummary = { total: 0, present: 0, late: 0, onLeave: 0, notCheckedIn: 0, absent: 0 }
const today = '2026-11-25'

const EMPTY: {
  hr: HrDashboard
  manager: ManagerDashboard
  seniorPm: SeniorPmDashboard
  associatePm: AssociatePmDashboard
  teamLead: TeamLeadDashboard
  employee: EmployeeDashboard
} = {
  hr: {
    metrics: {
      totalEmployees: 0,
      presentToday: 0,
      absentToday: 0,
      lateArrivals: 0,
      pendingLeaveRequests: 0,
    },
    departments: [],
    attendanceTrend: [],
    recentActivity: [],
  },
  manager: { teamAttendance: zeroSummary, teamLeaveRequests: [], approvalInbox: [], team: [] },
  seniorPm: {
    projectTeams: [],
    pendingApprovals: [],
    teamAttendance: zeroSummary,
    leaveSummary: { pending: 0, approvedThisMonth: 0, onLeaveToday: 0 },
  },
  associatePm: { team: [], teamAttendance: zeroSummary, reviewTasks: [] },
  teamLead: { team: [], teamAttendance: zeroSummary, reviewTasks: [] },
  employee: {
    today: { date: today, status: 'not_checked_in', checkInAt: null, checkOutAt: null },
    monthSummary: { presentDays: 0, lateDays: 0, leaveDays: 0 },
    leaveBalances: [],
    recentLeaveRequests: [],
    notifications: [],
    recentActivity: [],
  },
}

type Case = {
  name: string
  Page: ComponentType<{ service?: DashboardService }>
  method: keyof DashboardService
  empty: unknown
  loadedText: string
  emptyTexts: string[]
}

const real = createMockDashboardService({
  latencyMs: 0,
  now: () => new Date('2026-11-25T06:00:00Z'),
})

const CASES: Case[] = [
  {
    name: 'HR',
    Page: HrDashboardPage,
    method: 'getHrDashboard',
    empty: EMPTY.hr,
    loadedText: 'Engineering',
    emptyTexts: ['No attendance data yet', 'No departments yet', 'No recent activity'],
  },
  {
    name: 'Manager',
    Page: ManagerDashboardPage,
    method: 'getManagerDashboard',
    empty: EMPTY.manager,
    loadedText: 'Hina T.',
    emptyTexts: ['No team members'],
  },
  {
    name: 'Senior PM',
    Page: SeniorPmDashboardPage,
    method: 'getSeniorPmDashboard',
    empty: EMPTY.seniorPm,
    loadedText: 'Payroll Portal Revamp',
    emptyTexts: ['No project teams'],
  },
  {
    name: 'Associate PM',
    Page: AssociatePmDashboardPage,
    method: 'getAssociatePmDashboard',
    empty: EMPTY.associatePm,
    loadedText: 'Review and recommendation tasks',
    emptyTexts: ['No team members'],
  },
  {
    name: 'Team Lead',
    Page: TeamLeadDashboardPage,
    method: 'getTeamLeadDashboard',
    empty: EMPTY.teamLead,
    loadedText: 'Leave reviews',
    emptyTexts: ['No team members'],
  },
  {
    name: 'Employee',
    Page: EmployeeDashboardPage,
    method: 'getEmployeeDashboard',
    empty: EMPTY.employee,
    loadedText: 'Medical/Sick',
    emptyTexts: ['No notifications', 'No recent activity'],
  },
]

function serviceReturning(
  method: keyof DashboardService,
  impl: () => Promise<unknown>,
): DashboardService {
  return { ...real, [method]: impl } as DashboardService
}

function renderPage(Page: Case['Page'], service: DashboardService) {
  return renderWithProviders(
    withSignedInUser(
      user,
      <MemoryRouter>
        <Page service={service} />
      </MemoryRouter>,
    ),
  )
}

// Live attendance panels call the attendance service as a signed-in manager (mock viewer).
beforeEach(() => setMockViewer({ id: 'u-mgr-001', role: 'manager' }))

describe.each(CASES)('$name dashboard', ({ Page, method, empty, loadedText, emptyTexts }) => {
  it('shows a loading state', () => {
    renderPage(
      Page,
      serviceReturning(method, () => new Promise(() => {})),
    )
    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome back, Test' }),
    ).toBeInTheDocument()
  })

  it('shows the loaded data', async () => {
    renderPage(Page, real)
    expect((await screen.findAllByText(loadedText)).length).toBeGreaterThan(0)
  })

  it('shows empty states when there is nothing to show', async () => {
    renderPage(
      Page,
      serviceReturning(method, async () => empty),
    )
    for (const text of emptyTexts) {
      expect((await screen.findAllByText(text)).length).toBeGreaterThan(0)
    }
  })

  it('shows an error with retry and recovers', async () => {
    const impl = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(
        new ApiError({ status: 503, code: 'server_error', message: 'The server had a problem.' }),
      )
      .mockImplementation(() => (real[method] as () => Promise<unknown>)())
    renderPage(Page, serviceReturning(method, impl))
    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText(loadedText)).length).toBeGreaterThan(0)
  })
})

describe('dashboard details', () => {
  it('HR marks "absent" as provisional and Late-In as tracking only', async () => {
    renderPage(
      HrDashboardPage,
      serviceReturning('getHrDashboard', async () => buildMockHrDashboard(today)),
    )
    expect(await screen.findByText('Provisional definition')).toBeInTheDocument()
    expect(screen.getByText('Tracking only')).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: /Daily attendance for the last 14 days/ }),
    ).toBeInTheDocument()
  })

  it('Employee dashboard has the real check-in card (Phase 4)', async () => {
    renderPage(
      EmployeeDashboardPage,
      serviceReturning('getEmployeeDashboard', async () => buildMockEmployeeDashboard(today)),
    )
    expect(await screen.findByRole('button', { name: 'Check in' })).toBeEnabled()
    expect(screen.getByText('Pakistan time (Asia/Karachi)')).toBeInTheDocument()
    expect(screen.getAllByText(/days left/)).toHaveLength(3)
  })

  it('leave panels come from the leave service (Phase 5), linking to each request', async () => {
    renderPage(ManagerDashboardPage, real)
    const inbox = await screen.findByRole('region', { name: 'Approval inbox' })
    const link = await within(inbox).findByRole('link', { name: /Hamza Kareem · Annual leave/ })
    expect(link.getAttribute('href')).toMatch(/^\/leave\/requests\//)
    const team = screen.getByRole('region', { name: 'Team leave requests' })
    expect(await within(team).findByText(/Mariam Siddiq · Annual leave/)).toBeInTheDocument()
  })

  it('team dashboards show live attendance for the scope, not static numbers', async () => {
    renderPage(ManagerDashboardPage, real)
    expect(await screen.findByText(/people in scope/)).toBeInTheDocument()
    expect(screen.queryByText('Could not load today’s attendance')).not.toBeInTheDocument()
  })
})
