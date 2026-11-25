// Change tracking for edits (P3-T06): send only the fields that changed. The backend records the
// before/after values in the audit log (D-070), so the patch must be exact and minimal.
import type { Employee, EmployeeInput, EmployeePatch } from '../schemas/employee.schema'

const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'role',
  'departmentId',
  'designationId',
  'joiningDate',
  'managerIds',
  'teamIds',
  'projectIds',
] as const satisfies ReadonlyArray<keyof EmployeeInput>

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

/** Fields of `next` that differ from `current`. Id lists compare as sets (order is irrelevant). */
export function diffEmployee(current: Employee, next: EmployeeInput): EmployeePatch {
  const patch: EmployeePatch = {}
  for (const field of FIELDS) {
    const before = current[field]
    const after = next[field]
    const changed =
      Array.isArray(before) && Array.isArray(after) ? !sameIds(before, after) : before !== after
    if (changed) (patch as Record<string, unknown>)[field] = after
  }
  return patch
}
