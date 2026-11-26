// SettingsService (P8-T11…T16). Everyone can read (holidays affect leave duration for all); only
// HR can change. Every change is audited by the backend.
import type {
  AllocationDefaults,
  ApprovalSettings,
  CompanyInput,
  Settings,
} from '../schemas/settings.schema'

export interface SettingsService {
  get(options?: { signal?: AbortSignal }): Promise<Settings>
  updateCompany(input: CompanyInput): Promise<Settings>
  updateAllocation(input: AllocationDefaults): Promise<Settings>
  updateApprovals(input: ApprovalSettings): Promise<Settings>
  addHoliday(input: { date: string; name: string }): Promise<Settings>
  removeHoliday(id: string): Promise<Settings>
}
