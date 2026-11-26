// In-memory settings "backend" for mock mode (P8, D-080). Fictional company details. HR-only
// changes (403), validation (400), and an audit entry for every change.
import type {
  AllocationDefaults,
  ApprovalSettings,
  CompanyInput,
  Holiday,
  Settings,
} from '@/features/settings/schemas/settings.schema'
import { companyFormSchema, holidayFormSchema } from '@/features/settings/schemas/settings.schema'
import { toAppIsoString } from '@/lib/datetime'
import { ApiError } from '@/services/api'
import { ANNUAL_LEAVE_ALLOWANCE, LEAVE_TYPE_LABELS, LEAVE_TYPES } from '@/types/hr'
import { mockAuditStore, type AuditStore } from './audit-store'
import { mockHrStore } from './hr-store'
import { getMockViewer } from './mock-session'

const fresh = (): Settings => ({
  company: {
    companyName: 'Formbax (demo company)',
    legalName: 'Formbax Demo (Private) Limited',
    contactEmail: 'hr@formbaxhr.test',
    phone: '',
    address: 'Fictional address for the mock data',
    timezone: 'Asia/Karachi',
  },
  defaultAllocation: { ...ANNUAL_LEAVE_ALLOWANCE },
  approvals: { decisionRule: 'any', reviewRequired: false },
  holidays: [],
  updatedAt: null,
  updatedByName: null,
})

const invalid = (fieldErrors: Record<string, string[]>) =>
  new ApiError({
    status: 400,
    code: 'validation_error',
    message: 'Some fields are not valid.',
    fieldErrors,
  })

export function createSettingsStore(
  options: { now?: () => Date; audit?: AuditStore; nameOf?: (id: string) => string } = {},
) {
  const now = options.now ?? (() => new Date())
  const audit = options.audit ?? mockAuditStore
  let settings = fresh()
  let counter = 0

  function requireHr() {
    const v = getMockViewer()
    if (!v)
      throw new ApiError({
        status: 401,
        code: 'unauthorized',
        message: 'Your session has expired. Please sign in again.',
      })
    if (v.role !== 'hr_admin')
      throw new ApiError({
        status: 403,
        code: 'forbidden',
        message: 'You do not have permission to do this.',
      })
    return v
  }
  const copy = (): Settings => structuredClone(settings)

  function changed(section: string, before: Record<string, string>, after: Record<string, string>) {
    const v = requireHr()
    const name = options.nameOf?.(v.id) ?? v.id
    settings.updatedAt = toAppIsoString(now())
    settings.updatedByName = name
    audit.record({
      actorId: v.id,
      actorName: name,
      action: 'updated',
      entity: 'settings',
      entityId: section,
      entityLabel: section,
      before,
      after,
    })
  }

  const diff = (a: Record<string, string>, b: Record<string, string>) => {
    const keys = Object.keys(b).filter((k) => a[k] !== b[k])
    return [
      Object.fromEntries(keys.map((k) => [k, a[k] ?? ''])),
      Object.fromEntries(keys.map((k) => [k, b[k] ?? ''])),
    ] as const
  }

  return {
    reset() {
      settings = fresh()
      counter = 0
    },
    /** For other mock stores (no viewer check). */
    peek: (): Settings => settings,
    holidaySet: (): Set<string> => new Set(settings.holidays.map((h) => h.date)),

    get(): Settings {
      if (!getMockViewer())
        throw new ApiError({
          status: 401,
          code: 'unauthorized',
          message: 'Your session has expired. Please sign in again.',
        })
      return copy()
    },

    updateCompany(input: CompanyInput): Settings {
      requireHr()
      const parsed = companyFormSchema.safeParse(input)
      if (!parsed.success)
        throw invalid(
          Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), [i.message]])),
        )
      const [before, after] = diff(settings.company, parsed.data)
      settings.company = { ...settings.company, ...parsed.data }
      if (Object.keys(after).length > 0) changed('Company information', before, after)
      return copy()
    },

    updateAllocation(input: AllocationDefaults): Settings {
      requireHr()
      const errors: Record<string, string[]> = {}
      for (const t of LEAVE_TYPES) {
        const v = input[t]
        if (!Number.isInteger(v) || v < 0 || v > 365)
          errors[t] = ['Enter whole days from 0 to 365.']
      }
      if (Object.keys(errors).length > 0) throw invalid(errors)
      const label = (a: AllocationDefaults) =>
        Object.fromEntries(LEAVE_TYPES.map((t) => [LEAVE_TYPE_LABELS[t], String(a[t])]))
      const [before, after] = diff(label(settings.defaultAllocation), label(input))
      settings.defaultAllocation = { ...input }
      if (Object.keys(after).length > 0) changed('Leave allocation', before, after)
      return copy()
    },

    updateApprovals(input: ApprovalSettings): Settings {
      requireHr()
      const label = (a: ApprovalSettings) => ({
        'Several managers': a.decisionRule,
        'Review required': a.reviewRequired ? 'Yes' : 'No',
      })
      const [before, after] = diff(label(settings.approvals), label(input))
      settings.approvals = { ...input }
      if (Object.keys(after).length > 0) changed('Approval workflow', before, after)
      return copy()
    },

    addHoliday(input: { date: string; name: string }): Settings {
      requireHr()
      const parsed = holidayFormSchema.safeParse(input)
      if (!parsed.success)
        throw invalid(
          Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), [i.message]])),
        )
      if (settings.holidays.some((h) => h.date === parsed.data.date))
        throw invalid({ date: ['There is already a holiday on this date.'] })
      counter += 1
      const holiday: Holiday = { id: `hol-${counter}`, ...parsed.data }
      settings.holidays = [...settings.holidays, holiday].sort((a, b) =>
        a.date.localeCompare(b.date),
      )
      changed('Holidays', {}, { [holiday.date]: holiday.name })
      return copy()
    },

    removeHoliday(id: string): Settings {
      requireHr()
      const holiday = settings.holidays.find((h) => h.id === id)
      if (!holiday)
        throw new ApiError({
          status: 404,
          code: 'not_found',
          message: 'The requested item was not found.',
        })
      settings.holidays = settings.holidays.filter((h) => h.id !== id)
      changed('Holidays', { [holiday.date]: holiday.name }, {})
      return copy()
    },
  }
}

export type SettingsStore = ReturnType<typeof createSettingsStore>
export const mockSettingsStore = createSettingsStore({
  nameOf: (id) => mockHrStore.leaveOrg().people.find((p) => p.id === id)?.name ?? id,
})
