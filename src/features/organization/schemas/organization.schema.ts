// Organization contracts (P3-T01): departments, designations, teams, projects, reporting lines.
// Records are deactivated, never deleted (R-008, D-075 deviation table).
import { z } from 'zod'
import { ROLES } from '@/features/authentication/types'

export const recordStatusSchema = z.enum(['active', 'inactive'])
export type RecordStatus = z.infer<typeof recordStatusSchema>

const id = z.string().min(1)
const name = (label: string, max = 80) =>
  z
    .string()
    .trim()
    .min(2, `${label} must have at least 2 characters.`)
    .max(max, `${label} is too long.`)

export const departmentSchema = z.object({
  id,
  name: z.string(),
  code: z.string().nullable(),
  status: recordStatusSchema,
  headcount: z.number().int().nonnegative(),
})

export const designationSchema = z.object({
  id,
  title: z.string(),
  status: recordStatusSchema,
  headcount: z.number().int().nonnegative(),
})

export const teamSchema = z.object({
  id,
  name: z.string(),
  departmentId: id,
  teamLeadId: id.nullable(),
  memberIds: z.array(id),
  status: recordStatusSchema,
})

export const projectSchema = z.object({
  id,
  name: z.string(),
  code: z.string(),
  seniorPmId: id.nullable(),
  associatePmId: id.nullable(),
  teamIds: z.array(id),
  status: recordStatusSchema,
})

/** One person in the reporting hierarchy (used for the org chart and manager pickers). */
export const reportingLineSchema = z.object({
  id,
  name: z.string(),
  designation: z.string().nullable(),
  departmentName: z.string().nullable(),
  role: z.enum(ROLES),
  status: z.enum(['invited', 'active', 'inactive']),
  /** Zero (top of hierarchy / no manager), one or several managers (D-066, P3-T01). */
  managerIds: z.array(id),
})

export type Department = z.infer<typeof departmentSchema>
export type Designation = z.infer<typeof designationSchema>
export type Team = z.infer<typeof teamSchema>
export type Project = z.infer<typeof projectSchema>
export type ReportingLine = z.infer<typeof reportingLineSchema>

// --- Form / request inputs -------------------------------------------------------------------

const optionalCode = z
  .string()
  .trim()
  .max(12, 'Use at most 12 characters.')
  .regex(/^[A-Za-z0-9-]*$/, 'Use letters, digits and hyphens only.')
  .transform((value) => (value === '' ? null : value.toUpperCase()))

export const departmentInputSchema = z.object({
  name: name('Name'),
  code: optionalCode,
})
export type DepartmentInput = z.output<typeof departmentInputSchema>
export type DepartmentFormValues = z.input<typeof departmentInputSchema>

export const designationInputSchema = z.object({ title: name('Title') })
export type DesignationInput = z.output<typeof designationInputSchema>
export type DesignationFormValues = z.input<typeof designationInputSchema>

export const teamInputSchema = z.object({
  name: name('Name'),
  departmentId: z.string().min(1, 'Choose a department.'),
  teamLeadId: z.string().nullable(),
  memberIds: z.array(z.string()),
})
export type TeamInput = z.output<typeof teamInputSchema>
export type TeamFormValues = z.input<typeof teamInputSchema>

export const projectInputSchema = z
  .object({
    name: name('Name', 120),
    code: z
      .string()
      .trim()
      .min(2, 'Code must have at least 2 characters.')
      .max(12, 'Use at most 12 characters.')
      .regex(/^[A-Za-z0-9-]+$/, 'Use letters, digits and hyphens only.')
      .transform((value) => value.toUpperCase()),
    seniorPmId: z.string().nullable(),
    associatePmId: z.string().nullable(),
    teamIds: z.array(z.string()),
  })
  .refine((value) => !value.seniorPmId || value.seniorPmId !== value.associatePmId, {
    path: ['associatePmId'],
    message: 'The Associate PM must be a different person from the Senior PM.',
  })
export type ProjectInput = z.output<typeof projectInputSchema>
export type ProjectFormValues = z.input<typeof projectInputSchema>
