// HTTP OrganizationService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { z, type ZodType } from 'zod'
import { parseApiResponse, type HttpClient } from '@/services/api'
import {
  departmentSchema,
  designationSchema,
  projectSchema,
  reportingLineSchema,
  teamSchema,
} from '../schemas/organization.schema'
import type { OrganizationService } from './organization.service'

const snake: Record<string, string> = {
  departmentId: 'department_id',
  teamLeadId: 'team_lead_id',
  memberIds: 'member_ids',
  seniorPmId: 'senior_pm_id',
  associatePmId: 'associate_pm_id',
  teamIds: 'team_ids',
}
const body = (input: object) =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [snake[key] ?? key, value]))

export function createHttpOrganizationService(client: HttpClient): OrganizationService {
  const path = (resource: string, id?: string, action?: string) =>
    `${resource}/${id ? `${encodeURIComponent(id)}/` : ''}${action ? `${action}/` : ''}`

  async function list<T>(resource: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T[]> {
    return parseApiResponse(z.array(schema), await client.get(path(resource), { signal }))
  }
  async function create<T>(resource: string, schema: ZodType<T>, input: object): Promise<T> {
    return parseApiResponse(schema, await client.post(path(resource), body(input)))
  }
  async function update<T>(
    resource: string,
    schema: ZodType<T>,
    id: string,
    input: object,
  ): Promise<T> {
    return parseApiResponse(schema, await client.patch(path(resource, id), body(input)))
  }

  return {
    listDepartments: ({ signal } = {}) => list('departments', departmentSchema, signal),
    createDepartment: (input) => create('departments', departmentSchema, input),
    updateDepartment: (id, input) => update('departments', departmentSchema, id, input),
    setDepartmentStatus: (id, status) => update('departments', departmentSchema, id, { status }),

    listDesignations: ({ signal } = {}) => list('designations', designationSchema, signal),
    createDesignation: (input) => create('designations', designationSchema, input),
    updateDesignation: (id, input) => update('designations', designationSchema, id, input),
    setDesignationStatus: (id, status) => update('designations', designationSchema, id, { status }),

    listTeams: ({ signal } = {}) => list('teams', teamSchema, signal),
    saveTeam: (id, input) =>
      id ? update('teams', teamSchema, id, input) : create('teams', teamSchema, input),
    setTeamStatus: (id, status) => update('teams', teamSchema, id, { status }),

    listProjects: ({ signal } = {}) => list('projects', projectSchema, signal),
    saveProject: (id, input) =>
      id ? update('projects', projectSchema, id, input) : create('projects', projectSchema, input),
    setProjectStatus: (id, status) => update('projects', projectSchema, id, { status }),

    listReportingLines: ({ signal } = {}) =>
      list('employees/reporting-lines', reportingLineSchema, signal),
  }
}
