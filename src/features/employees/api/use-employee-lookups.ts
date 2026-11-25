// Loads everything the employee form and profile need to show names instead of ids.
import {
  useDepartments,
  useDesignations,
  useProjects,
  useReportingLines,
  useTeams,
} from '@/features/organization'
import type { EmployeeFormLookups } from '../components/employee-form'

export function useEmployeeLookups() {
  const queries = [
    useDepartments(),
    useDesignations(),
    useTeams(),
    useProjects(),
    useReportingLines(),
  ] as const
  const [departments, designations, teams, projects, people] = queries
  const failed = queries.find((query) => query.isError)
  const data: EmployeeFormLookups | undefined =
    departments.data && designations.data && teams.data && projects.data && people.data
      ? {
          departments: departments.data,
          designations: designations.data,
          teams: teams.data,
          projects: projects.data,
          people: people.data,
        }
      : undefined
  return {
    data,
    isPending: !data && !failed,
    error: failed?.error ?? null,
    refetch: () => queries.forEach((query) => void query.refetch()),
  }
}
