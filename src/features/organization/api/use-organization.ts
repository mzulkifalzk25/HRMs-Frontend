// TanStack Query hooks for organization data. Mutations refresh everything they can affect
// (headcounts, team members, employee records, reporting lines).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type {
  DepartmentInput,
  DesignationInput,
  ProjectInput,
  RecordStatus,
  TeamInput,
} from '../schemas/organization.schema'
import type { OrganizationService } from './organization.service'

export const organizationKeys = {
  all: ['organization'] as const,
  departments: ['organization', 'departments'] as const,
  designations: ['organization', 'designations'] as const,
  teams: ['organization', 'teams'] as const,
  projects: ['organization', 'projects'] as const,
  reportingLines: ['organization', 'reporting-lines'] as const,
}

const org = (service?: OrganizationService) => service ?? services.organization

export function useDepartments(service?: OrganizationService) {
  return useQuery({
    queryKey: organizationKeys.departments,
    queryFn: ({ signal }) => org(service).listDepartments({ signal }),
  })
}
export function useDesignations(service?: OrganizationService) {
  return useQuery({
    queryKey: organizationKeys.designations,
    queryFn: ({ signal }) => org(service).listDesignations({ signal }),
  })
}
export function useTeams(service?: OrganizationService) {
  return useQuery({
    queryKey: organizationKeys.teams,
    queryFn: ({ signal }) => org(service).listTeams({ signal }),
  })
}
export function useProjects(service?: OrganizationService) {
  return useQuery({
    queryKey: organizationKeys.projects,
    queryFn: ({ signal }) => org(service).listProjects({ signal }),
  })
}
export function useReportingLines(service?: OrganizationService) {
  return useQuery({
    queryKey: organizationKeys.reportingLines,
    queryFn: ({ signal }) => org(service).listReportingLines({ signal }),
  })
}

/** Invalidate organization data and employee data (membership and headcounts change together). */
function useRefreshAll() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
    ])
}

export type OrgEntity = 'department' | 'designation' | 'team' | 'project'

type SaveArgs =
  | { entity: 'department'; id: string | null; input: DepartmentInput }
  | { entity: 'designation'; id: string | null; input: DesignationInput }
  | { entity: 'team'; id: string | null; input: TeamInput }
  | { entity: 'project'; id: string | null; input: ProjectInput }

export function useSaveOrgRecord(service?: OrganizationService) {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (args: SaveArgs): Promise<unknown> => {
      const s = org(service)
      switch (args.entity) {
        case 'department':
          return args.id ? s.updateDepartment(args.id, args.input) : s.createDepartment(args.input)
        case 'designation':
          return args.id
            ? s.updateDesignation(args.id, args.input)
            : s.createDesignation(args.input)
        case 'team':
          return s.saveTeam(args.id, args.input)
        case 'project':
          return s.saveProject(args.id, args.input)
      }
    },
    onSuccess: refresh,
  })
}

export function useSetOrgRecordStatus(service?: OrganizationService) {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: ({
      entity,
      id,
      status,
    }: {
      entity: OrgEntity
      id: string
      status: RecordStatus
    }): Promise<unknown> => {
      const s = org(service)
      switch (entity) {
        case 'department':
          return s.setDepartmentStatus(id, status)
        case 'designation':
          return s.setDesignationStatus(id, status)
        case 'team':
          return s.setTeamStatus(id, status)
        case 'project':
          return s.setProjectStatus(id, status)
      }
    },
    onSuccess: refresh,
  })
}
