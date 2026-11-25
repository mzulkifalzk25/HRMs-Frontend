// @vitest-environment node
// The mock HR backend must behave like the real one will: scoping, permissions, validation.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Role } from '@/features/authentication/types'
import {
  employeeListItemSchema,
  employeeSchema,
  type EmployeeInput,
} from '@/features/employees/schemas/employee.schema'
import {
  departmentSchema,
  designationSchema,
  projectSchema,
  reportingLineSchema,
  teamSchema,
} from '@/features/organization/schemas/organization.schema'
import { createHrStore, type HrStore } from './hr-store'
import { setMockViewer } from './mock-session'

const ACCOUNTS: Record<Role, string> = {
  hr_admin: 'u-hr-001',
  manager: 'u-mgr-001',
  senior_pm: 'u-spm-001',
  associate_pm: 'u-apm-001',
  team_lead: 'u-tl-001',
  employee: 'u-emp-001',
}
const as = (role: Role) => setMockViewer({ id: ACCOUNTS[role], role })
const all = { page: 1, pageSize: 100 }
const ids = (store: HrStore) =>
  store
    .listEmployees(all)
    .results.map((e) => e.id)
    .sort()

const newHire: EmployeeInput = {
  firstName: 'Test',
  lastName: 'Hire',
  email: 'test.hire@formbaxhr.test',
  phone: null,
  role: 'employee',
  departmentId: 'd-eng',
  designationId: 'g-se',
  joiningDate: '2026-12-01',
  managerIds: ['u-mgr-001'],
  teamIds: ['t-fe'],
  projectIds: [],
}

let store: HrStore
beforeEach(() => {
  store = createHrStore()
  setMockViewer(null)
})

describe('contract: every response matches its schema', () => {
  it('employees, organization records and reporting lines', () => {
    as('hr_admin')
    for (const item of store.listEmployees(all).results) employeeListItemSchema.parse(item)
    employeeSchema.parse(store.getEmployee('e-103'))
    store.listDepartments().forEach((d) => departmentSchema.parse(d))
    store.listDesignations().forEach((d) => designationSchema.parse(d))
    store.listTeams().forEach((t) => teamSchema.parse(t))
    store.listProjects().forEach((p) => projectSchema.parse(p))
    store.reportingLines().forEach((r) => reportingLineSchema.parse(r))
  })

  it('uses only fictional data', () => {
    as('hr_admin')
    for (const e of store.listEmployees(all).results) expect(e.email).toMatch(/@formbaxhr\.test$/)
  })
})

describe('scoping by role (D-044, P3-T14)', () => {
  it('requires a signed-in viewer', () => {
    expect(() => store.listEmployees(all)).toThrow(expect.objectContaining({ status: 401 }))
  })

  it('HR sees everyone', () => {
    as('hr_admin')
    expect(store.listEmployees(all).count).toBe(21)
  })

  it('a manager sees direct and indirect reports, not themselves or other branches', () => {
    as('manager')
    const visible = ids(store)
    expect(visible).toContain('u-tl-001') // direct
    expect(visible).toContain('e-105') // via Hina (e-104)
    expect(visible).toContain('e-103') // multi-manager report
    expect(visible).not.toContain('u-mgr-001')
    expect(visible).not.toContain('e-112') // Finance, other branch
  })

  it('a team lead sees their team; a Senior/Associate PM their projects', () => {
    as('team_lead')
    expect(ids(store)).toEqual(['e-101', 'e-103', 'e-115', 'u-emp-001'])
    as('associate_pm')
    expect(ids(store)).toContain('e-109') // Product Design team on the portal project
    expect(ids(store)).not.toContain('e-102') // mobile project, other APM
    as('senior_pm')
    expect(ids(store)).toEqual(expect.arrayContaining(['e-102', 'e-109', 'u-apm-001', 'e-108']))
  })

  it('an employee has no directory and sees only their own record', () => {
    as('employee')
    expect(() => store.listEmployees(all)).toThrow(expect.objectContaining({ status: 403 }))
    expect(store.getEmployee('u-emp-001').email).toBe('employee@formbaxhr.test')
    expect(() => store.getEmployee('e-101')).toThrow(expect.objectContaining({ status: 404 }))
  })

  it('answers 404 (not 403) outside the scope so existence is not revealed', () => {
    as('team_lead')
    expect(() => store.getEmployee('e-112')).toThrow(expect.objectContaining({ status: 404 }))
  })
})

describe('directory query', () => {
  beforeEach(() => as('hr_admin'))

  it('searches name, email and employee code', () => {
    expect(store.listEmployees({ ...all, search: 'kareem' }).results.map((e) => e.id)).toEqual([
      'e-101',
    ])
    expect(store.listEmployees({ ...all, search: 'FBX-1001' }).results.map((e) => e.id)).toEqual([
      'u-hr-001',
    ])
    expect(store.listEmployees({ ...all, search: 'nobody-matches' }).count).toBe(0)
  })

  it('filters by department, team, role, status and manager', () => {
    expect(store.listEmployees({ ...all, departmentId: 'd-fin' }).count).toBe(2)
    expect(store.listEmployees({ ...all, teamId: 't-be' }).count).toBe(4)
    expect(store.listEmployees({ ...all, role: 'team_lead' }).count).toBe(2)
    expect(store.listEmployees({ ...all, status: 'invited' }).results.map((e) => e.id)).toEqual([
      'e-115',
    ])
    expect(store.listEmployees({ ...all, managerId: 'u-spm-001' }).count).toBe(3)
  })

  it('sorts and paginates', () => {
    const asc = store.listEmployees({ page: 1, pageSize: 5, ordering: 'joining_date' })
    expect(asc.results[0]?.joiningDate).toBe('2019-11-04')
    expect(asc.count).toBe(21)
    expect(asc.next).not.toBeNull()
    expect(asc.previous).toBeNull()
    const desc = store.listEmployees({ page: 1, pageSize: 5, ordering: '-joining_date' })
    expect(desc.results[0]?.joiningDate).toBe('2026-12-01')
    const last = store.listEmployees({ page: 5, pageSize: 5, ordering: 'joining_date' })
    expect(last.results).toHaveLength(1)
    expect(last.next).toBeNull()
  })
})

describe('changes are HR-only and validated', () => {
  it('rejects non-HR changes with 403', () => {
    as('manager')
    expect(() => store.createEmployee(newHire)).toThrow(expect.objectContaining({ status: 403 }))
    expect(() => store.updateEmployee('u-emp-001', { phone: '+92 300 0000000' })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
    expect(() => store.createDepartment({ name: 'Legal', code: null })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
  })

  it('creates an invited employee with a backend-assigned code and team membership', () => {
    as('hr_admin')
    const created = store.createEmployee(newHire)
    expect(created).toMatchObject({ status: 'invited', employeeCode: 'FBX-1021' }) // 20 seeded codes; the invited seed has none yet
    expect(store.listTeams().find((t) => t.id === 't-fe')?.memberIds).toContain(created.id)
  })

  it('rejects duplicate emails and inactive departments with field errors', () => {
    as('hr_admin')
    expect(() => store.createEmployee({ ...newHire, email: 'manager@formbaxhr.test' })).toThrow(
      expect.objectContaining({
        status: 400,
        fieldErrors: { email: ['An employee with this email already exists.'] },
      }),
    )
    expect(() => store.createEmployee({ ...newHire, departmentId: 'd-ops' })).toThrow(
      expect.objectContaining({ fieldErrors: { departmentId: ['Choose an active department.'] } }),
    )
  })

  it('rejects reporting cycles and self-reporting, naming the loop', () => {
    as('hr_admin')
    expect(() => store.updateEmployee('u-mgr-001', { managerIds: ['e-105'] })).toThrow(
      expect.objectContaining({
        fieldErrors: {
          managerIds: [
            'This would create a reporting loop: Imran Demo → Omar Farooq → Hina Tariq → Imran Demo.',
          ],
        },
      }),
    )
    expect(() => store.updateEmployee('e-101', { managerIds: ['e-101'] })).toThrow(
      expect.objectContaining({
        fieldErrors: { managerIds: ['An employee cannot report to themselves.'] },
      }),
    )
  })

  it('applies a valid partial update and keeps other fields', () => {
    as('hr_admin')
    const updated = store.updateEmployee('e-101', {
      phone: '+92 300 1234567',
      managerIds: ['u-mgr-001', 'e-104'],
    })
    expect(updated).toMatchObject({
      phone: '+92 300 1234567',
      managerIds: ['u-mgr-001', 'e-104'],
      firstName: 'Hamza',
    })
  })

  it('stops HR changing their own role or status (Q-ORG-05, provisional)', () => {
    as('hr_admin')
    expect(() => store.updateEmployee('u-hr-001', { role: 'employee' })).toThrow(
      expect.objectContaining({ status: 400 }),
    )
    expect(() => store.setEmployeeStatus('u-hr-001', false, 'Testing self')).toThrow(
      expect.objectContaining({ status: 400 }),
    )
    expect(store.updateEmployee('u-hr-001', { phone: '+92 300 7654321' }).phone).toBe(
      '+92 300 7654321',
    )
  })
})

describe('deactivation (never deletion)', () => {
  beforeEach(() => as('hr_admin'))

  it('requires a reason, then deactivates and can reactivate', () => {
    expect(() => store.setEmployeeStatus('e-101', false, '   ')).toThrow(
      expect.objectContaining({
        fieldErrors: { reason: ['Give a reason for deactivating this employee.'] },
      }),
    )
    const inactive = store.setEmployeeStatus('e-101', false, 'Resigned, last day today')
    expect(inactive).toMatchObject({
      status: 'inactive',
      deactivationReason: 'Resigned, last day today',
    })
    expect(store.setEmployeeStatus('e-101', true).status).toBe('active')
  })

  it('returns a never-activated account to "invited" when reactivated', () => {
    store.setEmployeeStatus('e-115', false, 'Offer withdrawn')
    expect(store.setEmployeeStatus('e-115', true).status).toBe('invited')
  })

  it('does not allow inactive people as managers', () => {
    expect(() => store.updateEmployee('e-106', { managerIds: ['e-114'] })).toThrow(
      expect.objectContaining({
        fieldErrors: { managerIds: ['Managers must be existing, active employees.'] },
      }),
    )
  })
})

describe('organization records', () => {
  beforeEach(() => as('hr_admin'))

  it('creates, renames and deactivates departments; names are unique', () => {
    const legal = store.createDepartment({ name: 'Legal', code: 'LGL' })
    expect(legal).toMatchObject({ status: 'active', headcount: 0 })
    expect(() => store.createDepartment({ name: 'legal', code: null })).toThrow(
      expect.objectContaining({ status: 400 }),
    )
    expect(store.updateDepartment(legal.id, { name: 'Legal & Compliance', code: 'LGL' }).name).toBe(
      'Legal & Compliance',
    )
    expect(store.setDepartmentStatus(legal.id, 'inactive').status).toBe('inactive')
    expect(store.listDepartments().find((d) => d.id === 'd-eng')?.headcount).toBe(11) // excludes the inactive person
  })

  it('sets team members as a whole list and updates employees', () => {
    const team = store.saveTeam('t-qa', {
      name: 'Quality Assurance',
      departmentId: 'd-eng',
      teamLeadId: 'e-102',
      memberIds: ['e-102'],
    })
    expect(team.memberIds).toEqual(['e-102'])
    expect(store.getEmployee('e-107').teamIds).not.toContain('t-qa')
  })

  it('checks project roles: Senior PM and Associate PM must hold those roles', () => {
    expect(() =>
      store.saveProject(null, {
        name: 'Payroll API',
        code: 'PAPI',
        seniorPmId: 'u-mgr-001',
        associatePmId: null,
        teamIds: [],
      }),
    ).toThrow(
      expect.objectContaining({
        fieldErrors: { seniorPmId: ['This person does not have the Senior Project Manager role.'] },
      }),
    )
    const project = store.saveProject(null, {
      name: 'Payroll API',
      code: 'PAPI',
      seniorPmId: 'u-spm-001',
      associatePmId: 'e-108',
      teamIds: ['t-be'],
    })
    expect(project).toMatchObject({ status: 'active', code: 'PAPI' })
    expect(() =>
      store.saveProject(null, {
        name: 'Another',
        code: 'PAPI',
        seniorPmId: null,
        associatePmId: null,
        teamIds: [],
      }),
    ).toThrow(expect.objectContaining({ fieldErrors: { code: ['This code is already used.'] } }))
  })
})
