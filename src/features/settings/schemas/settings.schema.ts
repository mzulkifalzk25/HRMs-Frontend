// Settings contracts (P8-T11…T16). Only values backed by confirmed decisions are editable:
// company details, the default leave allocation (D-062), company holidays that leave duration
// skips (D-088), and the approval options that D-067/D-089 make configurable. The attendance
// policy and working days are shown, not edited (Q-SET-01, Q-ATT-05 open).
import { z } from 'zod'
import { dateKeySchema, instantSchema, LEAVE_TYPES, type LeaveType } from '@/types/hr'

export const DECISION_RULES = ['any', 'all', 'sequential'] as const
export type DecisionRule = (typeof DECISION_RULES)[number]
export const DECISION_RULE_LABELS: Record<DecisionRule, string> = {
  any: 'Any one selected manager decides (default)',
  all: 'All selected managers must approve',
  sequential: 'Selected managers approve one after another',
}

export const companySettingsSchema = z.object({
  companyName: z.string(),
  legalName: z.string(),
  contactEmail: z.string(),
  phone: z.string(),
  address: z.string(),
  /** Fixed: every policy uses Pakistan time (D-050). */
  timezone: z.literal('Asia/Karachi'),
})
export type CompanySettings = z.infer<typeof companySettingsSchema>

export const holidaySchema = z.object({ id: z.string(), date: dateKeySchema, name: z.string() })
export type Holiday = z.infer<typeof holidaySchema>

export const settingsSchema = z.object({
  company: companySettingsSchema,
  defaultAllocation: z.record(z.enum(LEAVE_TYPES), z.number().int().nonnegative()),
  approvals: z.object({ decisionRule: z.enum(DECISION_RULES), reviewRequired: z.boolean() }),
  holidays: z.array(holidaySchema),
  updatedAt: instantSchema.nullable(),
  updatedByName: z.string().nullable(),
})
export type Settings = z.infer<typeof settingsSchema>

export type CompanyInput = Omit<CompanySettings, 'timezone'>
export type ApprovalSettings = Settings['approvals']
export type AllocationDefaults = Record<LeaveType, number>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const companyFormSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter the company name.').max(120),
  legalName: z.string().trim().max(160),
  contactEmail: z
    .string()
    .trim()
    .refine((v) => v === '' || EMAIL.test(v), 'Enter a valid email.'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9][0-9 -]{6,18}$/.test(v), 'Enter a valid phone number.'),
  address: z.string().trim().max(300),
})

export const holidayFormSchema = z.object({
  date: z.iso.date({ error: 'Choose a date.' }),
  name: z.string().trim().min(2, 'Enter a name.').max(80),
})
