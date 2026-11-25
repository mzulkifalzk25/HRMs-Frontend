// Directory state lives in the URL (shareable, back-button friendly). Pure parse/serialize.
import { ROLES, type Role } from '@/features/authentication/types'
import {
  DEFAULT_PAGE_SIZE,
  EMPLOYEE_SORT_FIELDS,
  EMPLOYEE_STATUSES,
  PAGE_SIZES,
  type EmployeeListQuery,
  type EmployeeStatus,
} from '../schemas/employee.schema'

const isRole = (value: string | null): value is Role => ROLES.includes(value as Role)
const isStatus = (value: string | null): value is EmployeeStatus =>
  EMPLOYEE_STATUSES.includes(value as EmployeeStatus)

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/** Unknown or invalid values fall back to defaults instead of breaking the page. */
export function parseDirectoryParams(params: URLSearchParams): EmployeeListQuery {
  const pageSize = positiveInt(params.get('size'), DEFAULT_PAGE_SIZE)
  const ordering = params.get('ordering') ?? ''
  const orderingField = ordering.replace(/^-/, '')
  const search = params.get('q')?.trim()
  return {
    page: positiveInt(params.get('page'), 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    search: search || undefined,
    departmentId: params.get('department') || undefined,
    teamId: params.get('team') || undefined,
    role: isRole(params.get('role')) ? (params.get('role') as Role) : undefined,
    status: isStatus(params.get('status')) ? (params.get('status') as EmployeeStatus) : undefined,
    managerId: params.get('manager') || undefined,
    ordering: (EMPLOYEE_SORT_FIELDS as readonly string[]).includes(orderingField)
      ? ordering
      : undefined,
  }
}

/** Only non-default values are written, so URLs stay short. */
export function serializeDirectoryParams(query: EmployeeListQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.search) params.set('q', query.search)
  if (query.departmentId) params.set('department', query.departmentId)
  if (query.teamId) params.set('team', query.teamId)
  if (query.role) params.set('role', query.role)
  if (query.status) params.set('status', query.status)
  if (query.managerId) params.set('manager', query.managerId)
  if (query.ordering) params.set('ordering', query.ordering)
  if (query.pageSize !== DEFAULT_PAGE_SIZE) params.set('size', String(query.pageSize))
  if (query.page > 1) params.set('page', String(query.page))
  return params
}

export function hasActiveFilters(query: EmployeeListQuery): boolean {
  return Boolean(
    query.search ||
    query.departmentId ||
    query.teamId ||
    query.role ||
    query.status ||
    query.managerId,
  )
}
