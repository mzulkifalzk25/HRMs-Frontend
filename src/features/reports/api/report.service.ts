// ReportService (P8-T01). Reports are computed by the backend within the caller's scope.
import type {
  AttendanceReport,
  DepartmentReport,
  EmployeeReport,
  LeaveReport,
  ReportFilters,
} from '../schemas/report.schema'

type Options = { signal?: AbortSignal }

export interface ReportService {
  attendance(filters: ReportFilters, options?: Options): Promise<AttendanceReport>
  leave(filters: ReportFilters, options?: Options): Promise<LeaveReport>
  employees(filters: ReportFilters, options?: Options): Promise<EmployeeReport>
  departments(filters: ReportFilters, options?: Options): Promise<DepartmentReport>
}
