// HTTP ReportService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { parseApiResponse, type HttpClient } from '@/services/api'
import {
  attendanceReportSchema,
  departmentReportSchema,
  employeeReportSchema,
  leaveReportSchema,
  type ReportFilters,
} from '../schemas/report.schema'
import type { ReportService } from './report.service'

const query = (f: ReportFilters) => ({
  from: f.from,
  to: f.to,
  department: f.departmentId,
  team: f.teamId,
  employee: f.employeeId,
})

export function createHttpReportService(client: HttpClient): ReportService {
  return {
    attendance: async (f, { signal } = {}) =>
      parseApiResponse(
        attendanceReportSchema,
        await client.get('reports/attendance/', { signal, query: query(f) }),
      ),
    leave: async (f, { signal } = {}) =>
      parseApiResponse(
        leaveReportSchema,
        await client.get('reports/leave/', { signal, query: query(f) }),
      ),
    employees: async (f, { signal } = {}) =>
      parseApiResponse(
        employeeReportSchema,
        await client.get('reports/employees/', { signal, query: query(f) }),
      ),
    departments: async (f, { signal } = {}) =>
      parseApiResponse(
        departmentReportSchema,
        await client.get('reports/departments/', { signal, query: query(f) }),
      ),
  }
}
