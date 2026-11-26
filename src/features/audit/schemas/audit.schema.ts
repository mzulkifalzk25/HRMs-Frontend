// Audit contracts (P8-T17). Append-only, read-only in the UI (P8-T19). The backend writes entries
// in the same transaction as the change; the app only lists them.
import { z } from 'zod'
import { instantSchema } from '@/types/hr'

export const AUDIT_ENTITIES = [
  'employee',
  'attendance',
  'leave_request',
  'leave_balance',
  'import',
  'settings',
] as const
export type AuditEntity = (typeof AUDIT_ENTITIES)[number]

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  employee: 'Employee',
  attendance: 'Attendance',
  leave_request: 'Leave request',
  leave_balance: 'Leave balance',
  import: 'Import',
  settings: 'Settings',
}

export const AUDIT_ACTIONS = [
  'created',
  'updated',
  'activated',
  'deactivated',
  'corrected',
  'approved',
  'declined',
  'cancelled',
  'adjusted',
  'imported',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  created: 'Created',
  updated: 'Updated',
  activated: 'Activated',
  deactivated: 'Deactivated',
  corrected: 'Corrected',
  approved: 'Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
  adjusted: 'Balance adjusted',
  imported: 'Imported',
}

const values = z.record(z.string(), z.string()).nullable()

export const auditEntrySchema = z.object({
  id: z.string(),
  at: instantSchema,
  actorId: z.string(),
  actorName: z.string(),
  action: z.enum(AUDIT_ACTIONS),
  entity: z.enum(AUDIT_ENTITIES),
  entityId: z.string(),
  entityLabel: z.string(),
  reason: z.string().nullable(),
  /** Changed fields only, as display strings. */
  before: values,
  after: values,
})
export type AuditEntry = z.infer<typeof auditEntrySchema>

export type AuditQuery = {
  page: number
  pageSize: number
  actorId?: string
  action?: AuditAction
  entity?: AuditEntity
  from?: string
  to?: string
  sort?: 'newest' | 'oldest'
}
