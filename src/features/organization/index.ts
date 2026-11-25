// Public API of the organization feature (docs/ARCHITECTURE.md §2).
// Pages are lazy-loaded by the router directly (code splitting).
export {
  organizationKeys,
  useDepartments,
  useDesignations,
  useProjects,
  useReportingLines,
  useTeams,
} from './api/use-organization'
export { buildReportingTree, findReportingCycle, transitiveReports } from './lib/hierarchy'
export type {
  Department,
  Designation,
  Project,
  RecordStatus,
  ReportingLine,
  Team,
} from './schemas/organization.schema'
export type { OrganizationService } from './api/organization.service'
