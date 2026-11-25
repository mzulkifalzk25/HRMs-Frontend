// HTTP DashboardService (proposed endpoints `GET dashboard/<role>/`, docs/API_INTEGRATION.md §6).
import type { ZodType } from 'zod'
import { parseApiResponse, type HttpClient } from '@/services/api'
import {
  associatePmDashboardSchema,
  employeeDashboardSchema,
  hrDashboardSchema,
  managerDashboardSchema,
  seniorPmDashboardSchema,
  teamLeadDashboardSchema,
} from '../schemas/dashboard.schema'
import type { DashboardService } from './dashboard.service'

export function createHttpDashboardService(client: HttpClient): DashboardService {
  async function get<T>(path: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
    return parseApiResponse(schema, await client.get(path, { signal }))
  }

  return {
    getHrDashboard: ({ signal } = {}) => get('dashboard/hr/', hrDashboardSchema, signal),
    getManagerDashboard: ({ signal } = {}) =>
      get('dashboard/manager/', managerDashboardSchema, signal),
    getSeniorPmDashboard: ({ signal } = {}) =>
      get('dashboard/senior-pm/', seniorPmDashboardSchema, signal),
    getAssociatePmDashboard: ({ signal } = {}) =>
      get('dashboard/associate-pm/', associatePmDashboardSchema, signal),
    getTeamLeadDashboard: ({ signal } = {}) =>
      get('dashboard/team-lead/', teamLeadDashboardSchema, signal),
    getEmployeeDashboard: ({ signal } = {}) =>
      get('dashboard/employee/', employeeDashboardSchema, signal),
  }
}
