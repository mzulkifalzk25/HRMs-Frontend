// Route table (P1-T13, P2-T07). Built by a factory so tests can inject fresh services.
// Dashboard pages are lazy-loaded (code splitting, R-022); they import page modules directly,
// a documented exception to "import features via index.ts" (docs/ARCHITECTURE.md §5).
import type { ComponentType } from 'react'
import { Outlet, type RouteObject } from 'react-router'
import { GuestOnly, RequireAuth, RequireRole, RoleHomeRedirect } from '@/app/guards/guards'
import { AppLayout } from '@/app/layouts/app-layout'
import { AuthLayout } from '@/app/layouts/auth-layout'
import {
  AcceptInvitationPage,
  AuthProvider,
  DASHBOARD_PATHS,
  ForgotPasswordPage,
  LoginPage,
  ProfilePage,
  ResetPasswordPage,
  type AuthService,
  type Role,
} from '@/features/authentication'
import type { HttpClient } from '@/services/api'
import { NotFoundPage } from './not-found-page'
import type { RouteHandle } from './route-handle'
import { RouteErrorPage } from './route-error-page'

const crumb = (breadcrumb: string): RouteHandle => ({ breadcrumb })

type LazyPage = () => Promise<{ Component: ComponentType }>

const DASHBOARD_PAGES: Record<Role, LazyPage> = {
  hr_admin: async () => ({
    Component: (await import('@/features/dashboard/pages/hr-dashboard-page')).HrDashboardPage,
  }),
  manager: async () => ({
    Component: (await import('@/features/dashboard/pages/manager-dashboard-page'))
      .ManagerDashboardPage,
  }),
  senior_pm: async () => ({
    Component: (await import('@/features/dashboard/pages/senior-pm-dashboard-page'))
      .SeniorPmDashboardPage,
  }),
  associate_pm: async () => ({
    Component: (await import('@/features/dashboard/pages/associate-pm-dashboard-page'))
      .AssociatePmDashboardPage,
  }),
  team_lead: async () => ({
    Component: (await import('@/features/dashboard/pages/team-lead-dashboard-page'))
      .TeamLeadDashboardPage,
  }),
  employee: async () => ({
    Component: (await import('@/features/dashboard/pages/employee-dashboard-page'))
      .EmployeeDashboardPage,
  }),
}

const lazyPage =
  <M,>(load: () => Promise<M>, pick: (module: M) => ComponentType): LazyPage =>
  async () => ({ Component: pick(await load()) })

const EMPLOYEE_PAGES = {
  directory: lazyPage(
    () => import('@/features/employees/pages/employee-directory-page'),
    (m) => m.EmployeeDirectoryPage,
  ),
  create: lazyPage(
    () => import('@/features/employees/pages/employee-create-page'),
    (m) => m.EmployeeCreatePage,
  ),
  profile: lazyPage(
    () => import('@/features/employees/pages/employee-profile-page'),
    (m) => m.EmployeeProfilePage,
  ),
  edit: lazyPage(
    () => import('@/features/employees/pages/employee-edit-page'),
    (m) => m.EmployeeEditPage,
  ),
}
const ATTENDANCE_PAGES = {
  mine: lazyPage(
    () => import('@/features/attendance/pages/my-attendance-page'),
    (m) => m.MyAttendancePage,
  ),
  records: lazyPage(
    () => import('@/features/attendance/pages/attendance-records-page'),
    (m) => m.AttendanceRecordsPage,
  ),
}
const ORGANIZATION_PAGES = {
  manage: lazyPage(
    () => import('@/features/organization/pages/organization-page'),
    (m) => m.OrganizationPage,
  ),
  chart: lazyPage(
    () => import('@/features/organization/pages/org-chart-page'),
    (m) => m.OrgChartPage,
  ),
}

/** Roles with a directory (employees only see their own record via /profile, D-044). */
export const DIRECTORY_ROLES: readonly Role[] = [
  'hr_admin',
  'manager',
  'senior_pm',
  'associate_pm',
  'team_lead',
]

/** Phase 3 routes (UX guards only; the API enforces scope and HR-only changes, D-027). */
function employeeAndOrganizationRoutes(): RouteObject[] {
  return [
    {
      path: 'employees',
      handle: crumb('Employees'),
      children: [
        {
          element: <RequireRole allow={DIRECTORY_ROLES} />,
          children: [{ index: true, lazy: EMPLOYEE_PAGES.directory }],
        },
        {
          element: <RequireRole allow={['hr_admin']} />,
          children: [{ path: 'new', lazy: EMPLOYEE_PAGES.create, handle: crumb('Add employee') }],
        },
        {
          path: ':employeeId',
          handle: crumb('Employee'),
          children: [
            { index: true, lazy: EMPLOYEE_PAGES.profile },
            {
              element: <RequireRole allow={['hr_admin']} />,
              children: [{ path: 'edit', lazy: EMPLOYEE_PAGES.edit, handle: crumb('Edit') }],
            },
          ],
        },
      ],
    },
    {
      path: 'attendance',
      handle: crumb('Attendance'),
      children: [
        { index: true, lazy: ATTENDANCE_PAGES.mine },
        {
          element: <RequireRole allow={DIRECTORY_ROLES} />,
          children: [{ path: 'records', lazy: ATTENDANCE_PAGES.records, handle: crumb('Records') }],
        },
      ],
    },
    {
      path: 'organization',
      handle: crumb('Organization'),
      children: [
        {
          element: <RequireRole allow={['hr_admin']} />,
          children: [{ index: true, lazy: ORGANIZATION_PAGES.manage }],
        },
        { path: 'chart', lazy: ORGANIZATION_PAGES.chart, handle: crumb('Org chart') },
      ],
    },
  ]
}

/** Each role dashboard is visible only to that role (UX only; the API scopes the data, D-027). */
function dashboardRoutes(): RouteObject[] {
  return (Object.keys(DASHBOARD_PATHS) as Role[]).map((role) => ({
    path: DASHBOARD_PATHS[role].slice(1),
    element: <RequireRole allow={[role]} />,
    handle: crumb('Dashboard'),
    children: [{ index: true, lazy: DASHBOARD_PAGES[role] }],
  }))
}

export function createAppRoutes(
  options: { authService?: AuthService; client?: HttpClient } = {},
): RouteObject[] {
  return [
    {
      element: (
        <AuthProvider authService={options.authService} client={options.client}>
          <Outlet />
        </AuthProvider>
      ),
      errorElement: <RouteErrorPage />,
      children: [
        {
          element: <GuestOnly />,
          children: [
            {
              element: <AuthLayout />,
              children: [
                { path: 'login', element: <LoginPage /> },
                { path: 'forgot-password', element: <ForgotPasswordPage /> },
              ],
            },
          ],
        },
        {
          // Emailed links work whether or not someone is signed in on this browser.
          element: <AuthLayout />,
          children: [
            { path: 'reset-password', element: <ResetPasswordPage /> },
            { path: 'invite', element: <AcceptInvitationPage /> },
          ],
        },
        {
          element: <RequireAuth />,
          children: [
            {
              element: <AppLayout />,
              errorElement: <RouteErrorPage />,
              children: [
                { index: true, element: <RoleHomeRedirect /> },
                ...dashboardRoutes(),
                ...employeeAndOrganizationRoutes(),
                { path: 'profile', element: <ProfilePage />, handle: crumb('My profile') },
                { path: '*', element: <NotFoundPage />, handle: crumb('Not found') },
              ],
            },
          ],
        },
      ],
    },
  ]
}

export const routes = createAppRoutes()
