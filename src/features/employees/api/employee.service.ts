// EmployeeService contract (P3-T02). The backend scopes every call to the caller (D-044):
// out-of-scope ids answer 404; changes are HR-only (403 otherwise).
import type { Page } from '@/types/api'
import type {
  Employee,
  EmployeeInput,
  EmployeeListItem,
  EmployeeListQuery,
  EmployeePatch,
} from '../schemas/employee.schema'

type Options = { signal?: AbortSignal }

export interface EmployeeService {
  list(query: EmployeeListQuery, options?: Options): Promise<Page<EmployeeListItem>>
  get(id: string, options?: Options): Promise<Employee>
  /** Creates the record and sends an invitation; the account starts as `invited` (D-043). */
  create(input: EmployeeInput): Promise<Employee>
  /** Only changed fields (see lib/employee-diff.ts); the backend audits before/after. */
  update(id: string, patch: EmployeePatch): Promise<Employee>
  deactivate(id: string, reason: string): Promise<Employee>
  activate(id: string): Promise<Employee>
}
