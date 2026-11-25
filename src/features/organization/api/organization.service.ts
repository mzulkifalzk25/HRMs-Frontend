// OrganizationService contract (P3-T02): departments, designations, teams, projects, reporting lines.
// Reads are allowed for signed-in users; changes are HR-only (403 otherwise). Nothing is deleted:
// records are deactivated (R-008).
import type {
  Department,
  DepartmentInput,
  Designation,
  DesignationInput,
  Project,
  ProjectInput,
  RecordStatus,
  ReportingLine,
  Team,
  TeamInput,
} from '../schemas/organization.schema'

type Options = { signal?: AbortSignal }

export interface OrganizationService {
  listDepartments(options?: Options): Promise<Department[]>
  createDepartment(input: DepartmentInput): Promise<Department>
  updateDepartment(id: string, input: DepartmentInput): Promise<Department>
  setDepartmentStatus(id: string, status: RecordStatus): Promise<Department>

  listDesignations(options?: Options): Promise<Designation[]>
  createDesignation(input: DesignationInput): Promise<Designation>
  updateDesignation(id: string, input: DesignationInput): Promise<Designation>
  setDesignationStatus(id: string, status: RecordStatus): Promise<Designation>

  listTeams(options?: Options): Promise<Team[]>
  /** `id: null` creates. Members are set as a whole list. */
  saveTeam(id: string | null, input: TeamInput): Promise<Team>
  setTeamStatus(id: string, status: RecordStatus): Promise<Team>

  listProjects(options?: Options): Promise<Project[]>
  saveProject(id: string | null, input: ProjectInput): Promise<Project>
  setProjectStatus(id: string, status: RecordStatus): Promise<Project>

  /** Everyone's managers, for the org chart and manager pickers. */
  listReportingLines(options?: Options): Promise<ReportingLine[]>
}
