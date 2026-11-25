// HTTP EmployeeService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { parseApiResponse, type HttpClient } from '@/services/api'
import { pageSchema } from '@/types/api'
import {
  employeeListItemSchema,
  employeeSchema,
  type EmployeeInput,
  type EmployeePatch,
} from '../schemas/employee.schema'
import type { EmployeeService } from './employee.service'

const listSchema = pageSchema(employeeListItemSchema)

/** camelCase input → snake_case request body (DRF). */
function toRequestBody(input: EmployeePatch | EmployeeInput): Record<string, unknown> {
  const map: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    departmentId: 'department_id',
    designationId: 'designation_id',
    joiningDate: 'joining_date',
    managerIds: 'manager_ids',
    teamIds: 'team_ids',
    projectIds: 'project_ids',
  }
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [map[key] ?? key, value]))
}

export function createHttpEmployeeService(client: HttpClient): EmployeeService {
  return {
    async list(query, { signal } = {}) {
      const body = await client.get('employees/', {
        signal,
        query: {
          page: query.page,
          page_size: query.pageSize,
          search: query.search,
          department: query.departmentId,
          team: query.teamId,
          role: query.role,
          status: query.status,
          manager: query.managerId,
          ordering: query.ordering,
        },
      })
      return parseApiResponse(listSchema, body)
    },
    async get(id, { signal } = {}) {
      return parseApiResponse(
        employeeSchema,
        await client.get(`employees/${encodeURIComponent(id)}/`, { signal }),
      )
    },
    async create(input) {
      return parseApiResponse(employeeSchema, await client.post('employees/', toRequestBody(input)))
    },
    async update(id, patch) {
      return parseApiResponse(
        employeeSchema,
        await client.patch(`employees/${encodeURIComponent(id)}/`, toRequestBody(patch)),
      )
    },
    async deactivate(id, reason) {
      return parseApiResponse(
        employeeSchema,
        await client.post(`employees/${encodeURIComponent(id)}/deactivate/`, { reason }),
      )
    },
    async activate(id) {
      return parseApiResponse(
        employeeSchema,
        await client.post(`employees/${encodeURIComponent(id)}/activate/`),
      )
    },
  }
}
