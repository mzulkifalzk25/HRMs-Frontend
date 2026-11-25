// In-memory HR "backend" for mock mode (P3-T02, D-080). FICTIONAL data only (D-073): names are
// invented, emails use the reserved `.test` domain. It imitates the server's responsibilities so
// screens are exercised realistically: scoping by the signed-in viewer (D-044), HR-only changes
// (403), unknown/out-of-scope ids (404, so existence is not revealed), duplicate emails (400),
// reporting cycles (400) and deactivation instead of deletion (R-008).
import type { Role } from '@/features/authentication/types'
import type {
  Employee,
  EmployeeInput,
  EmployeeListItem,
  EmployeeListQuery,
  EmployeePatch,
} from '@/features/employees/schemas/employee.schema'
import { EMPLOYEE_POLICY } from '@/features/employees/lib/employee-policy'
import { findReportingCycle, transitiveReports } from '@/features/organization/lib/hierarchy'
import type {
  Department,
  DepartmentInput,
  Designation,
  DesignationInput,
  Project,
  ProjectInput,
  RecordStatus,
  ReportingLine,
  Team,
  TeamInput,
} from '@/features/organization/schemas/organization.schema'
import { ApiError } from '@/services/api'
import type { Page } from '@/types/api'
import { getMockViewer, type MockViewer } from './mock-session'

type StoredEmployee = Employee & { hasActivated: boolean }
type StoredTeam = Omit<Team, 'memberIds'>
type StoredDepartment = Omit<Department, 'headcount'>
type StoredDesignation = Omit<Designation, 'headcount'>

// --- Seed data ---------------------------------------------------------------------------------

const DEPARTMENTS: StoredDepartment[] = [
  { id: 'd-eng', name: 'Engineering', code: 'ENG', status: 'active' },
  { id: 'd-del', name: 'Delivery', code: 'DEL', status: 'active' },
  { id: 'd-des', name: 'Design', code: 'DES', status: 'active' },
  { id: 'd-hr', name: 'Human Resources', code: 'HR', status: 'active' },
  { id: 'd-fin', name: 'Finance', code: 'FIN', status: 'active' },
  { id: 'd-ops', name: 'Operations', code: 'OPS', status: 'inactive' },
]

const DESIGNATIONS: StoredDesignation[] = [
  { id: 'g-hra', title: 'HR Administrator', status: 'active' },
  { id: 'g-hre', title: 'HR Executive', status: 'active' },
  { id: 'g-em', title: 'Engineering Manager', status: 'active' },
  { id: 'g-spm', title: 'Senior Project Manager', status: 'active' },
  { id: 'g-apm', title: 'Associate Project Manager', status: 'active' },
  { id: 'g-tl', title: 'Team Lead', status: 'active' },
  { id: 'g-sse', title: 'Senior Software Engineer', status: 'active' },
  { id: 'g-se', title: 'Software Engineer', status: 'active' },
  { id: 'g-qa', title: 'QA Engineer', status: 'active' },
  { id: 'g-pd', title: 'Product Designer', status: 'active' },
  { id: 'g-acc', title: 'Accountant', status: 'active' },
  { id: 'g-ops', title: 'DevOps Engineer', status: 'active' },
]

type Seed = [
  id: string,
  first: string,
  last: string,
  role: Role,
  department: string,
  designation: string,
  joining: string,
  managers: string[],
  teams: string[],
  projects: string[],
  status?: 'invited' | 'active' | 'inactive',
]

// The first six are the mock login accounts (same ids as auth.mock.ts).
const EMPLOYEES: Seed[] = [
  ['u-hr-001', 'Sana', 'Demo', 'hr_admin', 'd-hr', 'g-hra', '2021-03-01', [], [], []],
  ['u-mgr-001', 'Imran', 'Demo', 'manager', 'd-eng', 'g-em', '2020-07-15', [], [], []],
  [
    'u-spm-001',
    'Farah',
    'Demo',
    'senior_pm',
    'd-del',
    'g-spm',
    '2019-11-04',
    [],
    [],
    ['p-portal', 'p-mobile'],
  ],
  [
    'u-apm-001',
    'Usman',
    'Demo',
    'associate_pm',
    'd-del',
    'g-apm',
    '2022-02-14',
    ['u-spm-001'],
    [],
    ['p-portal'],
  ],
  [
    'u-tl-001',
    'Zainab',
    'Demo',
    'team_lead',
    'd-eng',
    'g-tl',
    '2021-09-01',
    ['u-mgr-001'],
    ['t-fe'],
    ['p-portal'],
  ],
  [
    'u-emp-001',
    'Ali',
    'Demo',
    'employee',
    'd-eng',
    'g-se',
    '2023-05-08',
    ['u-mgr-001'],
    ['t-fe'],
    ['p-portal'],
  ],
  [
    'e-101',
    'Hamza',
    'Kareem',
    'employee',
    'd-eng',
    'g-se',
    '2023-01-09',
    ['u-mgr-001'],
    ['t-fe'],
    ['p-portal'],
  ],
  [
    'e-102',
    'Mariam',
    'Siddiq',
    'employee',
    'd-eng',
    'g-qa',
    '2022-08-22',
    ['u-mgr-001'],
    ['t-qa'],
    ['p-mobile'],
  ],
  [
    'e-103',
    'Bilal',
    'Rana',
    'employee',
    'd-eng',
    'g-sse',
    '2020-10-12',
    ['u-mgr-001', 'u-spm-001'],
    ['t-fe'],
    ['p-portal', 'p-mobile'],
  ],
  [
    'e-104',
    'Hina',
    'Tariq',
    'team_lead',
    'd-eng',
    'g-tl',
    '2021-04-19',
    ['u-mgr-001'],
    ['t-be'],
    ['p-portal'],
  ],
  [
    'e-105',
    'Omar',
    'Farooq',
    'employee',
    'd-eng',
    'g-ops',
    '2022-06-01',
    ['e-104'],
    ['t-be'],
    ['p-portal'],
  ],
  [
    'e-106',
    'Ayesha',
    'Noor',
    'employee',
    'd-eng',
    'g-se',
    '2024-02-05',
    ['e-104'],
    ['t-be'],
    ['p-portal'],
  ],
  [
    'e-107',
    'Danish',
    'Malik',
    'employee',
    'd-eng',
    'g-qa',
    '2023-09-18',
    ['u-mgr-001'],
    ['t-qa'],
    ['p-mobile'],
  ],
  [
    'e-108',
    'Nida',
    'Parvez',
    'associate_pm',
    'd-del',
    'g-apm',
    '2022-11-07',
    ['u-spm-001'],
    [],
    ['p-mobile'],
  ],
  [
    'e-109',
    'Rabia',
    'Naseem',
    'employee',
    'd-des',
    'g-pd',
    '2021-12-13',
    [],
    ['t-design'],
    ['p-portal'],
  ],
  [
    'e-110',
    'Saad',
    'Iqbal',
    'employee',
    'd-des',
    'g-pd',
    '2024-07-22',
    ['e-109'],
    ['t-design'],
    ['p-mobile'],
  ],
  ['e-111', 'Zara', 'Haider', 'employee', 'd-hr', 'g-hre', '2023-03-27', ['u-hr-001'], [], []],
  ['e-112', 'Kamran', 'Aslam', 'employee', 'd-fin', 'g-acc', '2020-01-20', [], [], []],
  ['e-113', 'Mehwish', 'Javed', 'employee', 'd-fin', 'g-acc', '2022-04-11', ['e-112'], [], []],
  [
    'e-114',
    'Faisal',
    'Raza',
    'employee',
    'd-eng',
    'g-se',
    '2025-01-06',
    ['e-104'],
    ['t-be'],
    ['p-portal'],
    'inactive',
  ],
  [
    'e-115',
    'Sadia',
    'Akram',
    'employee',
    'd-eng',
    'g-se',
    '2026-12-01',
    ['u-mgr-001'],
    ['t-fe'],
    [],
    'invited',
  ],
]

const TEAMS: StoredTeam[] = [
  { id: 't-fe', name: 'Frontend', departmentId: 'd-eng', teamLeadId: 'u-tl-001', status: 'active' },
  { id: 't-be', name: 'Backend', departmentId: 'd-eng', teamLeadId: 'e-104', status: 'active' },
  {
    id: 't-qa',
    name: 'Quality Assurance',
    departmentId: 'd-eng',
    teamLeadId: null,
    status: 'active',
  },
  {
    id: 't-design',
    name: 'Product Design',
    departmentId: 'd-des',
    teamLeadId: 'e-109',
    status: 'active',
  },
]

const PROJECTS: Project[] = [
  {
    id: 'p-portal',
    name: 'Payroll Portal Revamp',
    code: 'PPR',
    seniorPmId: 'u-spm-001',
    associatePmId: 'u-apm-001',
    teamIds: ['t-fe', 't-be', 't-design'],
    status: 'active',
  },
  {
    id: 'p-mobile',
    name: 'Mobile Attendance App',
    code: 'MAA',
    seniorPmId: 'u-spm-001',
    associatePmId: 'e-108',
    teamIds: ['t-qa'],
    status: 'active',
  },
  {
    id: 'p-onboard',
    name: 'Client Onboarding',
    code: 'COB',
    seniorPmId: null,
    associatePmId: null,
    teamIds: [],
    status: 'inactive',
  },
]

function seedEmployees(): StoredEmployee[] {
  return EMPLOYEES.map(
    (
      [
        id,
        firstName,
        lastName,
        role,
        departmentId,
        designationId,
        joiningDate,
        managerIds,
        teamIds,
        projectIds,
        status = 'active',
      ],
      index,
    ) => ({
      id,
      employeeCode: status === 'invited' ? null : `FBX-${1001 + index}`,
      firstName,
      lastName,
      email: id.startsWith('u-')
        ? (
            {
              'u-hr-001': 'hr.admin',
              'u-mgr-001': 'manager',
              'u-spm-001': 'senior.pm',
              'u-apm-001': 'associate.pm',
              'u-tl-001': 'team.lead',
              'u-emp-001': 'employee',
            } as Record<string, string>
          )[id] + '@formbaxhr.test'
        : `${firstName}.${lastName}@formbaxhr.test`.toLowerCase(),
      phone: null,
      role,
      departmentId,
      designationId,
      joiningDate,
      status,
      managerIds,
      teamIds,
      projectIds,
      deactivationReason: status === 'inactive' ? 'Left the company (mock data).' : null,
      hasActivated: status !== 'invited',
    }),
  )
}

// --- Errors ------------------------------------------------------------------------------------

const notFound = () =>
  new ApiError({ status: 404, code: 'not_found', message: 'The requested item was not found.' })
const forbidden = () =>
  new ApiError({
    status: 403,
    code: 'forbidden',
    message: 'You do not have permission to do this.',
  })
const unauthorized = () =>
  new ApiError({
    status: 401,
    code: 'unauthorized',
    message: 'Your session has expired. Please sign in again.',
  })
const invalid = (fieldErrors: Record<string, string[]>, message = 'Some fields are not valid.') =>
  new ApiError({ status: 400, code: 'validation_error', message, fieldErrors })

// --- Store -------------------------------------------------------------------------------------

export function createHrStore() {
  let employees = seedEmployees()
  let departments = DEPARTMENTS.map((d) => ({ ...d }))
  let designations = DESIGNATIONS.map((d) => ({ ...d }))
  let teams = TEAMS.map((t) => ({ ...t }))
  let projects = PROJECTS.map((p) => ({ ...p, teamIds: [...p.teamIds] }))
  let counter = 1000

  const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`
  const fullName = (e: Pick<Employee, 'firstName' | 'lastName'>) => `${e.firstName} ${e.lastName}`
  const byId = <T extends { id: string }>(items: T[], id: string | null | undefined) =>
    id ? items.find((item) => item.id === id) : undefined

  function requireViewer(): MockViewer {
    const viewer = getMockViewer()
    if (!viewer) throw unauthorized()
    return viewer
  }

  function requireHr(): MockViewer {
    const viewer = requireViewer()
    if (viewer.role !== 'hr_admin') throw forbidden()
    return viewer
  }

  /** Ids the viewer may see in the employee directory (D-044, P3-T14). Null = everyone. */
  function scopeFor(viewer: MockViewer): Set<string> | null {
    if (viewer.role === 'hr_admin') return null
    if (viewer.role === 'employee') return new Set([viewer.id])
    const scope = transitiveReports(employees, viewer.id)
    const addTeam = (teamId: string) => {
      for (const e of employees) if (e.teamIds.includes(teamId)) scope.add(e.id)
    }
    if (viewer.role === 'team_lead') {
      for (const team of teams) if (team.teamLeadId === viewer.id) addTeam(team.id)
    }
    if (viewer.role === 'senior_pm' || viewer.role === 'associate_pm') {
      const key = viewer.role === 'senior_pm' ? 'seniorPmId' : 'associatePmId'
      for (const project of projects) {
        if (project[key] !== viewer.id) continue
        project.teamIds.forEach(addTeam)
        for (const e of employees) if (e.projectIds.includes(project.id)) scope.add(e.id)
      }
    }
    scope.delete(viewer.id)
    return scope
  }

  const inScope = (viewer: MockViewer, id: string) => {
    const scope = scopeFor(viewer)
    return scope === null || scope.has(id) || id === viewer.id
  }

  function toListItem(e: StoredEmployee): EmployeeListItem {
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      role: e.role,
      status: e.status,
      departmentName: byId(departments, e.departmentId)?.name ?? null,
      designationTitle: byId(designations, e.designationId)?.title ?? null,
      managerNames: e.managerIds
        .map((id) => byId(employees, id))
        .filter((m) => m !== undefined)
        .map(fullName),
      joiningDate: e.joiningDate,
    }
  }

  const toEmployee = ({ hasActivated: _hasActivated, ...e }: StoredEmployee): Employee => ({
    ...e,
    managerIds: [...e.managerIds],
    teamIds: [...e.teamIds],
    projectIds: [...e.projectIds],
  })

  /** Server-side validation shared by create and update. */
  function validateEmployee(next: EmployeeInput, selfId: string | null) {
    const errors: Record<string, string[]> = {}
    const emailOwner = employees.find((e) => e.email === next.email)
    if (emailOwner && emailOwner.id !== selfId)
      errors.email = ['An employee with this email already exists.']
    const department = byId(departments, next.departmentId)
    if (!department || department.status !== 'active')
      errors.departmentId = ['Choose an active department.']
    const designation = byId(designations, next.designationId)
    if (!designation || designation.status !== 'active')
      errors.designationId = ['Choose an active designation.']
    for (const managerId of next.managerIds) {
      const manager = byId(employees, managerId)
      if (managerId === selfId) errors.managerIds = ['An employee cannot report to themselves.']
      else if (!manager || manager.status === 'inactive')
        errors.managerIds = ['Managers must be existing, active employees.']
    }
    if (!errors.managerIds && selfId) {
      const cycle = findReportingCycle(employees, selfId, next.managerIds)
      if (cycle) {
        const names = cycle.map((id) =>
          byId(employees, id) ? fullName(byId(employees, id) as StoredEmployee) : id,
        )
        errors.managerIds = [`This would create a reporting loop: ${names.join(' → ')}.`]
      }
    }
    for (const teamId of next.teamIds) {
      const team = byId(teams, teamId)
      if (!team || team.status !== 'active') errors.teamIds = ['Teams must exist and be active.']
    }
    for (const projectId of next.projectIds) {
      const project = byId(projects, projectId)
      if (!project || project.status !== 'active')
        errors.projectIds = ['Projects must exist and be active.']
    }
    if (Object.keys(errors).length > 0) throw invalid(errors)
  }

  const departmentView = (d: StoredDepartment): Department => ({
    ...d,
    headcount: employees.filter((e) => e.departmentId === d.id && e.status !== 'inactive').length,
  })
  const designationView = (d: StoredDesignation): Designation => ({
    ...d,
    headcount: employees.filter((e) => e.designationId === d.id && e.status !== 'inactive').length,
  })
  const teamView = (t: StoredTeam): Team => ({
    ...t,
    memberIds: employees.filter((e) => e.teamIds.includes(t.id)).map((e) => e.id),
  })

  function uniqueName<T extends { id: string }>(
    items: T[],
    get: (item: T) => string,
    value: string,
    selfId: string | null,
    field: string,
  ) {
    if (
      items.some((item) => item.id !== selfId && get(item).toLowerCase() === value.toLowerCase())
    ) {
      throw invalid({ [field]: ['This name is already used.'] })
    }
  }

  function requireActiveEmployee(id: string | null, field: string, role?: Role) {
    if (!id) return
    const person = byId(employees, id)
    if (!person || person.status === 'inactive')
      throw invalid({ [field]: ['Choose an active employee.'] })
    if (role && person.role !== role) {
      throw invalid({
        [field]: [
          `This person does not have the ${role === 'senior_pm' ? 'Senior Project Manager' : 'Associate Project Manager'} role.`,
        ],
      })
    }
  }

  return {
    // Shared with the attendance mock (same people, same scope rules as the directory).
    /** Ids the signed-in viewer may see (null = everyone). Throws 401 when signed out. */
    visibleEmployeeIds(): Set<string> | null {
      return scopeFor(requireViewer())
    },
    /** People attendance is recorded for, with what attendance screens display. */
    attendancePeople(): Array<{
      id: string
      name: string
      departmentId: string | null
      departmentName: string | null
      teamIds: string[]
      status: Employee['status']
      joiningDate: string
    }> {
      return employees.map((e) => ({
        id: e.id,
        name: fullName(e),
        departmentId: e.departmentId,
        departmentName: byId(departments, e.departmentId)?.name ?? null,
        teamIds: [...e.teamIds],
        status: e.status,
        joiningDate: e.joiningDate,
      }))
    },

    reset() {
      employees = seedEmployees()
      departments = DEPARTMENTS.map((d) => ({ ...d }))
      designations = DESIGNATIONS.map((d) => ({ ...d }))
      teams = TEAMS.map((t) => ({ ...t }))
      projects = PROJECTS.map((p) => ({ ...p, teamIds: [...p.teamIds] }))
      counter = 1000
    },

    // Employees ----------------------------------------------------------------------------------

    listEmployees(query: EmployeeListQuery): Page<EmployeeListItem> {
      const viewer = requireViewer()
      if (viewer.role === 'employee') throw forbidden()
      const scope = scopeFor(viewer)
      const search = query.search?.trim().toLowerCase()
      let rows = employees.filter((e) => scope === null || scope.has(e.id))
      if (search) {
        rows = rows.filter((e) =>
          [fullName(e), e.email, e.employeeCode ?? ''].some((value) =>
            value.toLowerCase().includes(search),
          ),
        )
      }
      if (query.departmentId) rows = rows.filter((e) => e.departmentId === query.departmentId)
      if (query.teamId) rows = rows.filter((e) => e.teamIds.includes(query.teamId as string))
      if (query.role) rows = rows.filter((e) => e.role === query.role)
      if (query.status) rows = rows.filter((e) => e.status === query.status)
      if (query.managerId)
        rows = rows.filter((e) => e.managerIds.includes(query.managerId as string))

      const ordering = query.ordering ?? 'last_name'
      const desc = ordering.startsWith('-')
      const field = desc ? ordering.slice(1) : ordering
      const key = (e: StoredEmployee): string =>
        field === 'joining_date'
          ? e.joiningDate
          : field === 'employee_code'
            ? (e.employeeCode ?? '')
            : `${e.lastName} ${e.firstName}`
      rows = [...rows].sort(
        (a, b) => key(a).localeCompare(key(b)) * (desc ? -1 : 1) || a.id.localeCompare(b.id),
      )

      const start = (query.page - 1) * query.pageSize
      return {
        count: rows.length,
        next: start + query.pageSize < rows.length ? `?page=${query.page + 1}` : null,
        previous: query.page > 1 ? `?page=${query.page - 1}` : null,
        results: rows.slice(start, start + query.pageSize).map(toListItem),
      }
    },

    getEmployee(id: string): Employee {
      const viewer = requireViewer()
      const employee = byId(employees, id)
      if (!employee || !inScope(viewer, id)) throw notFound()
      return toEmployee(employee)
    },

    createEmployee(input: EmployeeInput): Employee {
      requireHr()
      validateEmployee(input, null)
      const maxCode = Math.max(1000, ...employees.map((e) => Number(e.employeeCode?.slice(4) ?? 0)))
      const created: StoredEmployee = {
        id: nextId('e'),
        employeeCode: `FBX-${maxCode + 1}`,
        ...input,
        status: 'invited', // the backend emails an invitation (D-043, P2-T06)
        deactivationReason: null,
        hasActivated: false,
      }
      employees.push(created)
      return toEmployee(created)
    },

    updateEmployee(id: string, patch: EmployeePatch): Employee {
      const viewer = requireHr()
      const current = byId(employees, id)
      if (!current) throw notFound()
      if (
        id === viewer.id &&
        !EMPLOYEE_POLICY.hrCanChangeOwnRoleOrStatus &&
        patch.role &&
        patch.role !== current.role
      ) {
        throw invalid({ role: ['You cannot change your own role. Ask another HR administrator.'] })
      }
      const next: EmployeeInput = {
        firstName: patch.firstName ?? current.firstName,
        lastName: patch.lastName ?? current.lastName,
        email: patch.email ?? current.email,
        phone: patch.phone !== undefined ? patch.phone : current.phone,
        role: patch.role ?? current.role,
        departmentId: patch.departmentId ?? current.departmentId ?? '',
        designationId: patch.designationId ?? current.designationId ?? '',
        joiningDate: patch.joiningDate ?? current.joiningDate,
        managerIds: patch.managerIds ?? current.managerIds,
        teamIds: patch.teamIds ?? current.teamIds,
        projectIds: patch.projectIds ?? current.projectIds,
      }
      validateEmployee(next, id)
      Object.assign(current, next)
      return toEmployee(current)
    },

    setEmployeeStatus(id: string, active: boolean, reason?: string): Employee {
      const viewer = requireHr()
      const current = byId(employees, id)
      if (!current) throw notFound()
      if (id === viewer.id) throw invalid({}, 'You cannot change the status of your own account.')
      if (!active) {
        const trimmed = reason?.trim() ?? ''
        if (
          EMPLOYEE_POLICY.deactivationReasonRequired &&
          trimmed.length < EMPLOYEE_POLICY.deactivationReasonMinLength
        ) {
          throw invalid({ reason: ['Give a reason for deactivating this employee.'] })
        }
        current.status = 'inactive'
        current.deactivationReason = trimmed || null
      } else {
        current.status = current.hasActivated ? 'active' : 'invited'
        current.deactivationReason = null
      }
      return toEmployee(current)
    },

    /** Org chart and manager pickers. Everyone signed in may view reporting lines (provisional). */
    reportingLines(): ReportingLine[] {
      requireViewer()
      return employees.map((e) => ({
        id: e.id,
        name: fullName(e),
        designation: byId(designations, e.designationId)?.title ?? null,
        departmentName: byId(departments, e.departmentId)?.name ?? null,
        role: e.role,
        status: e.status,
        managerIds: [...e.managerIds],
      }))
    },

    // Organization -------------------------------------------------------------------------------

    listDepartments: (): Department[] => (requireViewer(), departments.map(departmentView)),
    createDepartment(input: DepartmentInput): Department {
      requireHr()
      uniqueName(departments, (d) => d.name, input.name, null, 'name')
      const created = { id: nextId('d'), ...input, status: 'active' as RecordStatus }
      departments.push(created)
      return departmentView(created)
    },
    updateDepartment(id: string, input: DepartmentInput): Department {
      requireHr()
      const current = byId(departments, id)
      if (!current) throw notFound()
      uniqueName(departments, (d) => d.name, input.name, id, 'name')
      Object.assign(current, input)
      return departmentView(current)
    },
    setDepartmentStatus(id: string, status: RecordStatus): Department {
      requireHr()
      const current = byId(departments, id)
      if (!current) throw notFound()
      current.status = status
      return departmentView(current)
    },

    listDesignations: (): Designation[] => (requireViewer(), designations.map(designationView)),
    createDesignation(input: DesignationInput): Designation {
      requireHr()
      uniqueName(designations, (d) => d.title, input.title, null, 'title')
      const created = { id: nextId('g'), ...input, status: 'active' as RecordStatus }
      designations.push(created)
      return designationView(created)
    },
    updateDesignation(id: string, input: DesignationInput): Designation {
      requireHr()
      const current = byId(designations, id)
      if (!current) throw notFound()
      uniqueName(designations, (d) => d.title, input.title, id, 'title')
      Object.assign(current, input)
      return designationView(current)
    },
    setDesignationStatus(id: string, status: RecordStatus): Designation {
      requireHr()
      const current = byId(designations, id)
      if (!current) throw notFound()
      current.status = status
      return designationView(current)
    },

    listTeams: (): Team[] => (requireViewer(), teams.map(teamView)),
    saveTeam(id: string | null, input: TeamInput): Team {
      requireHr()
      const department = byId(departments, input.departmentId)
      if (!department || department.status !== 'active')
        throw invalid({ departmentId: ['Choose an active department.'] })
      uniqueName(teams, (t) => t.name, input.name, id, 'name')
      requireActiveEmployee(input.teamLeadId, 'teamLeadId')
      for (const memberId of input.memberIds) requireActiveEmployee(memberId, 'memberIds')
      let team = id ? byId(teams, id) : undefined
      if (id && !team) throw notFound()
      if (!team) {
        team = {
          id: nextId('t'),
          name: input.name,
          departmentId: input.departmentId,
          teamLeadId: input.teamLeadId,
          status: 'active',
        }
        teams.push(team)
      } else {
        Object.assign(team, {
          name: input.name,
          departmentId: input.departmentId,
          teamLeadId: input.teamLeadId,
        })
      }
      const teamId = team.id
      for (const e of employees) {
        const member = input.memberIds.includes(e.id)
        if (member && !e.teamIds.includes(teamId)) e.teamIds = [...e.teamIds, teamId]
        if (!member && e.teamIds.includes(teamId)) e.teamIds = e.teamIds.filter((t) => t !== teamId)
      }
      return teamView(team)
    },
    setTeamStatus(id: string, status: RecordStatus): Team {
      requireHr()
      const current = byId(teams, id)
      if (!current) throw notFound()
      current.status = status
      return teamView(current)
    },

    listProjects: (): Project[] => (
      requireViewer(),
      projects.map((p) => ({ ...p, teamIds: [...p.teamIds] }))
    ),
    saveProject(id: string | null, input: ProjectInput): Project {
      requireHr()
      if (projects.some((p) => p.id !== id && p.code === input.code))
        throw invalid({ code: ['This code is already used.'] })
      requireActiveEmployee(input.seniorPmId, 'seniorPmId', 'senior_pm')
      requireActiveEmployee(input.associatePmId, 'associatePmId', 'associate_pm')
      for (const teamId of input.teamIds) {
        if (!byId(teams, teamId)) throw invalid({ teamIds: ['Teams must exist.'] })
      }
      let project = id ? byId(projects, id) : undefined
      if (id && !project) throw notFound()
      if (!project) {
        project = { id: nextId('p'), status: 'active', ...input, teamIds: [...input.teamIds] }
        projects.push(project)
      } else {
        Object.assign(project, { ...input, teamIds: [...input.teamIds] })
      }
      return { ...project, teamIds: [...project.teamIds] }
    },
    setProjectStatus(id: string, status: RecordStatus): Project {
      requireHr()
      const current = byId(projects, id)
      if (!current) throw notFound()
      current.status = status
      return { ...current, teamIds: [...current.teamIds] }
    },
  }
}

export type HrStore = ReturnType<typeof createHrStore>

/** The shared mock store used by the registry. Tests reset it between cases. */
export const mockHrStore = createHrStore()
