// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { employeeFormSchema, employeeToFormValues, type Employee } from '../schemas/employee.schema'
import {
  hasActiveFilters,
  parseDirectoryParams,
  serializeDirectoryParams,
} from './directory-params'
import { diffEmployee } from './employee-diff'

const employee: Employee = {
  id: 'e-1',
  employeeCode: 'FBX-1001',
  firstName: 'Hamza',
  lastName: 'Kareem',
  email: 'hamza.kareem@formbaxhr.test',
  phone: null,
  role: 'employee',
  departmentId: 'd-eng',
  designationId: 'g-se',
  joiningDate: '2023-01-09',
  status: 'active',
  managerIds: ['m-1', 'm-2'],
  teamIds: ['t-1'],
  projectIds: [],
  deactivationReason: null,
}

describe('diffEmployee (P3-T06: only changed fields)', () => {
  const unchanged = employeeFormSchema.parse(employeeToFormValues(employee))

  it('returns an empty patch when nothing changed, even with re-ordered ids', () => {
    expect(diffEmployee(employee, unchanged)).toEqual({})
    expect(diffEmployee(employee, { ...unchanged, managerIds: ['m-2', 'm-1'] })).toEqual({})
  })

  it('includes exactly the changed fields', () => {
    expect(
      diffEmployee(employee, {
        ...unchanged,
        phone: '+92 300 1234567',
        managerIds: ['m-1'],
        role: 'team_lead',
      }),
    ).toEqual({ phone: '+92 300 1234567', managerIds: ['m-1'], role: 'team_lead' })
  })

  it('detects clearing a value and replacing a list', () => {
    const withPhone = { ...employee, phone: '+92 300 1111111' }
    expect(diffEmployee(withPhone, { ...unchanged, phone: null })).toEqual({ phone: null })
    expect(diffEmployee(employee, { ...unchanged, teamIds: ['t-2'] })).toEqual({ teamIds: ['t-2'] })
  })
})

describe('employeeFormSchema', () => {
  const valid = employeeToFormValues(employee)

  it('normalizes email and empty phone', () => {
    const parsed = employeeFormSchema.parse({
      ...valid,
      email: ' Hamza.Kareem@FormbaxHR.test ',
      phone: '',
    })
    expect(parsed.email).toBe('hamza.kareem@formbaxhr.test')
    expect(parsed.phone).toBeNull()
  })

  it.each([
    ['firstName', '', 'Enter the first name.'],
    ['email', 'not-an-email', 'Enter a valid email address.'],
    ['phone', 'abc', 'Enter a valid phone number.'],
    ['departmentId', '', 'Choose a department.'],
    ['designationId', '', 'Choose a designation.'],
    ['joiningDate', '', 'Enter the joining date.'],
    ['joiningDate', '2026-02-30', 'Enter a valid date (YYYY-MM-DD).'],
  ])('rejects %s = %j', (field, value, message) => {
    const result = employeeFormSchema.safeParse({ ...valid, [field]: value })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.message)).toContain(message)
  })

  it('accepts several managers or none', () => {
    expect(employeeFormSchema.safeParse({ ...valid, managerIds: [] }).success).toBe(true)
    expect(employeeFormSchema.safeParse({ ...valid, managerIds: ['a', 'b', 'c'] }).success).toBe(
      true,
    )
  })
})

describe('directory URL parameters', () => {
  it('round-trips a full query and omits defaults', () => {
    const query = {
      page: 3,
      pageSize: 50,
      search: 'ali',
      departmentId: 'd-eng',
      teamId: 't-fe',
      role: 'employee' as const,
      status: 'active' as const,
      managerId: 'u-mgr-001',
      ordering: '-joining_date',
    }
    expect(parseDirectoryParams(serializeDirectoryParams(query))).toEqual(query)
    expect(serializeDirectoryParams({ page: 1, pageSize: 25 }).toString()).toBe('')
  })

  it('falls back to defaults for invalid values', () => {
    const parsed = parseDirectoryParams(
      new URLSearchParams(
        'page=-2&size=999&role=superuser&status=deleted&ordering=salary&q=%20%20',
      ),
    )
    expect(parsed).toEqual({
      page: 1,
      pageSize: 25,
      search: undefined,
      departmentId: undefined,
      teamId: undefined,
      role: undefined,
      status: undefined,
      managerId: undefined,
      ordering: undefined,
    })
  })

  it('knows whether filters are active', () => {
    expect(hasActiveFilters({ page: 2, pageSize: 25, ordering: 'last_name' })).toBe(false)
    expect(hasActiveFilters({ page: 1, pageSize: 25, teamId: 't-fe' })).toBe(true)
  })
})
