// Employee contracts and form schema (P3-T01). Required fields and personal-data scope are
// provisional until Q-ORG-01 is answered (see lib/employee-policy.ts).
import { z } from 'zod'
import { ROLES } from '@/features/authentication/types'
import { dateKeySchema } from '@/types/hr'

/** Account lifecycle: HR creates the employee (invitation sent), they activate, HR may deactivate. */
export const EMPLOYEE_STATUSES = ['invited', 'active', 'inactive'] as const
export const employeeStatusSchema = z.enum(EMPLOYEE_STATUSES)
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  invited: 'Invitation sent',
  active: 'Active',
  inactive: 'Inactive',
}

export const employeeSchema = z.object({
  id: z.string(),
  employeeCode: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  phone: z.string().nullable(),
  role: z.enum(ROLES),
  departmentId: z.string().nullable(),
  designationId: z.string().nullable(),
  joiningDate: dateKeySchema,
  status: employeeStatusSchema,
  managerIds: z.array(z.string()),
  teamIds: z.array(z.string()),
  projectIds: z.array(z.string()),
  deactivationReason: z.string().nullable(),
})
export type Employee = z.infer<typeof employeeSchema>

/** Directory row: names resolved by the backend so the list needs one request. */
export const employeeListItemSchema = z.object({
  id: z.string(),
  employeeCode: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  role: z.enum(ROLES),
  status: employeeStatusSchema,
  departmentName: z.string().nullable(),
  designationTitle: z.string().nullable(),
  managerNames: z.array(z.string()),
  joiningDate: dateKeySchema,
})
export type EmployeeListItem = z.infer<typeof employeeListItemSchema>

export const EMPLOYEE_SORT_FIELDS = ['last_name', 'joining_date', 'employee_code'] as const
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number]

export type EmployeeListQuery = {
  page: number
  pageSize: number
  search?: string
  departmentId?: string
  teamId?: string
  role?: (typeof ROLES)[number]
  status?: EmployeeStatus
  /** Direct reports of this manager. */
  managerId?: string
  /** DRF ordering, e.g. `last_name` or `-joining_date`. */
  ordering?: string
}

export const PAGE_SIZES = [10, 25, 50] as const
export const DEFAULT_PAGE_SIZE = 25

// --- Form ------------------------------------------------------------------------------------

const personName = (label: string) =>
  z.string().trim().min(1, `Enter the ${label}.`).max(50, `The ${label} is too long.`)

export const employeeFormSchema = z.object({
  firstName: personName('first name'),
  lastName: personName('last name'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter the work email address.')
    .pipe(z.email('Enter a valid email address.'))
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\+?[0-9][0-9 -]{6,18}$/.test(value),
      'Enter a valid phone number.',
    )
    .transform((value) => (value === '' ? null : value)),
  role: z.enum(ROLES, { error: 'Choose a role.' }),
  departmentId: z.string().min(1, 'Choose a department.'),
  designationId: z.string().min(1, 'Choose a designation.'),
  joiningDate: z
    .string()
    .min(1, 'Enter the joining date.')
    .pipe(z.iso.date({ error: 'Enter a valid date (YYYY-MM-DD).' })),
  managerIds: z.array(z.string()),
  teamIds: z.array(z.string()),
  projectIds: z.array(z.string()),
})
export type EmployeeFormValues = z.input<typeof employeeFormSchema>
export type EmployeeInput = z.output<typeof employeeFormSchema>

export const EMPTY_EMPLOYEE_FORM: EmployeeFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'employee',
  departmentId: '',
  designationId: '',
  joiningDate: '',
  managerIds: [],
  teamIds: [],
  projectIds: [],
}

export function employeeToFormValues(employee: Employee): EmployeeFormValues {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? '',
    role: employee.role,
    departmentId: employee.departmentId ?? '',
    designationId: employee.designationId ?? '',
    joiningDate: employee.joiningDate,
    managerIds: employee.managerIds,
    teamIds: employee.teamIds,
    projectIds: employee.projectIds,
  }
}

export type EmployeePatch = Partial<EmployeeInput>
