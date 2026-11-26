// HTTP SettingsService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { parseApiResponse, type HttpClient } from '@/services/api'
import { settingsSchema } from '../schemas/settings.schema'
import type { SettingsService } from './settings.service'

export function createHttpSettingsService(client: HttpClient): SettingsService {
  const parse = (body: unknown) => parseApiResponse(settingsSchema, body)
  return {
    get: async ({ signal } = {}) => parse(await client.get('settings/', { signal })),
    updateCompany: async (input) =>
      parse(
        await client.put('settings/company/', {
          company_name: input.companyName,
          legal_name: input.legalName,
          contact_email: input.contactEmail,
          phone: input.phone,
          address: input.address,
        }),
      ),
    updateAllocation: async (input) => parse(await client.put('settings/leave-allocation/', input)),
    updateApprovals: async (input) =>
      parse(
        await client.put('settings/approvals/', {
          decision_rule: input.decisionRule,
          review_required: input.reviewRequired,
        }),
      ),
    addHoliday: async (input) => parse(await client.post('settings/holidays/', input)),
    removeHoliday: async (id) =>
      parse(await client.delete(`settings/holidays/${encodeURIComponent(id)}/`)),
  }
}
