// DashboardService contract (P2-T12): one method per role dashboard.
// The backend scopes every response to the signed-in user (own team, own records, D-044).
import type {
  AssociatePmDashboard,
  EmployeeDashboard,
  HrDashboard,
  ManagerDashboard,
  SeniorPmDashboard,
  TeamLeadDashboard,
} from '../schemas/dashboard.schema'

type Options = { signal?: AbortSignal }

export interface DashboardService {
  getHrDashboard(options?: Options): Promise<HrDashboard>
  getManagerDashboard(options?: Options): Promise<ManagerDashboard>
  getSeniorPmDashboard(options?: Options): Promise<SeniorPmDashboard>
  getAssociatePmDashboard(options?: Options): Promise<AssociatePmDashboard>
  getTeamLeadDashboard(options?: Options): Promise<TeamLeadDashboard>
  getEmployeeDashboard(options?: Options): Promise<EmployeeDashboard>
}
