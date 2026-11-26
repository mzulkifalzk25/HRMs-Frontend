// Leave and approval contracts (P5-T01). Types are inferred from these schemas so the mock, the
// HTTP implementation and the screens share one definition. The API sends snake_case (camelized
// by the client). Roles in a request are separate concepts (D-064): decision-makers, optional
// reviewers and always-notified recipients.
import { z } from 'zod'
import {
  dateKeySchema,
  instantSchema,
  LEAVE_TYPE_LABELS,
  leaveStatusSchema,
  leaveTypeSchema,
  type LeaveType,
} from '@/types/hr'
import { LEDGER_KINDS } from '../lib/balance'
import { leaveDays } from '../lib/duration'
import {
  ATTACHMENT_MESSAGES,
  attachmentProblem,
  LEAVE_POLICY,
  leaveYearOf,
} from '../lib/leave-policy'
import { ROUTE_TARGETS } from '../lib/routing'
import { ACTION_KINDS, COMPLETION_RULES, STEP_KINDS, STEP_MODES } from '../lib/workflow'

const days = z.number().int()

// --- Balances and ledger ------------------------------------------------------------------------

export const leaveBalanceSchema = z.object({
  leaveType: leaveTypeSchema,
  allocated: days,
  used: days,
  remaining: days,
})
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>

/** Immutable ledger entry (P5-T03): every balance change, with actor, time, reason and request. */
export const ledgerEntrySchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  leaveType: leaveTypeSchema,
  year: z.number().int(),
  kind: z.enum(LEDGER_KINDS),
  /** Positive for allocation/deduction/reversal; signed for HR adjustments. */
  days,
  reason: z.string(),
  actorName: z.string(),
  at: instantSchema,
  requestId: z.string().nullable(),
})
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>

export const LEDGER_KIND_LABELS: Record<LedgerEntry['kind'], string> = {
  allocation: 'Allocation',
  adjustment: 'HR adjustment',
  deduction: 'Approved leave',
  reversal: 'Cancelled leave returned',
}

export type AllocationAdjustment = {
  employeeId: string
  leaveType: LeaveType
  year: number
  /** Signed whole days added to (or removed from) the allocation. */
  days: number
  reason: string
}

// --- Requests -----------------------------------------------------------------------------------

export const attachmentSchema = z.object({
  name: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
})

export const PARTICIPANT_KINDS = ['decision_maker', 'reviewer', 'recipient'] as const
export const participantSchema = z.object({
  employeeId: z.string(),
  name: z.string(),
  kind: z.enum(PARTICIPANT_KINDS),
  /** True for HR recipients: always notified and cannot be removed (D-064). */
  mandatory: z.boolean(),
})
export type Participant = z.infer<typeof participantSchema>

export const approvalStepSchema = z.object({
  id: z.string(),
  kind: z.enum(STEP_KINDS),
  mode: z.enum(STEP_MODES),
  completion: z.enum(COMPLETION_RULES),
  required: z.boolean(),
  assigneeIds: z.array(z.string()),
})
export type ApprovalStep = z.infer<typeof approvalStepSchema>

export const actionKindSchema = z.enum(ACTION_KINDS)

/** One entry of a request's timeline: decision, recommendation, comment, override or cancel. */
export const approvalActionSchema = z.object({
  id: z.string(),
  stepId: z.string().nullable(),
  actorId: z.string(),
  actorName: z.string(),
  kind: actionKindSchema,
  comment: z.string().nullable(),
  at: instantSchema,
})
export type ApprovalAction = z.infer<typeof approvalActionSchema>

export const leaveRequestSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  departmentName: z.string().nullable(),
  leaveType: leaveTypeSchema,
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  /** Working days (Monday–Friday, holidays excluded, D-088). */
  requestedDays: z.number().int().positive(),
  reason: z.string(),
  status: leaveStatusSchema,
  /** The request started before the day it was submitted (allowed, D-088). */
  backdated: z.boolean(),
  attachment: attachmentSchema.nullable(),
  submittedAt: instantSchema,
})
export type LeaveRequest = z.infer<typeof leaveRequestSchema>

export const leaveRequestDetailSchema = leaveRequestSchema.extend({
  /** Optimistic-concurrency token: actions send it back; a stale one answers 409. */
  version: z.number().int().nonnegative(),
  routedTo: z.enum(ROUTE_TARGETS),
  steps: z.array(approvalStepSchema),
  participants: z.array(participantSchema),
  actions: z.array(approvalActionSchema),
  /** What the signed-in user may do now (computed by the backend). */
  allowedActions: z.array(actionKindSchema),
})
export type LeaveRequestDetail = z.infer<typeof leaveRequestDetailSchema>

/** An inbox row: a request plus what the signed-in user is asked to do. */
export const approvalTaskSchema = leaveRequestSchema.extend({
  stage: z.enum(['review', 'recommendation', 'final_approval']),
})
export type ApprovalTask = z.infer<typeof approvalTaskSchema>

export const routePreviewSchema = z.object({
  routedTo: z.enum(ROUTE_TARGETS),
  managerChoices: z.array(z.object({ id: z.string(), name: z.string() })),
  participants: z.array(participantSchema),
  problem: z.string().nullable(),
})
export type RoutePreview = z.infer<typeof routePreviewSchema>

export const leaveSummarySchema = z.object({
  pending: z.number().int().nonnegative(),
  approvedThisMonth: z.number().int().nonnegative(),
  onLeaveToday: z.number().int().nonnegative(),
})
export type LeaveSummary = z.infer<typeof leaveSummarySchema>

export type LeaveListQuery = {
  page: number
  pageSize: number
  status?: LeaveRequest['status']
  leaveType?: LeaveType
  departmentId?: string
  employeeId?: string
  /** Requests overlapping this date range. */
  from?: string
  to?: string
}

export type InboxTab = 'pending' | 'history'

export type ActionInput = {
  action: Exclude<ApprovalAction['kind'], 'cancel'>
  comment: string | null
  version: number
}

// --- Application form ---------------------------------------------------------------------------

export type LeaveApplicationInput = {
  leaveType: LeaveType
  startDate: string
  endDate: string
  requestedDays: number
  reason: string
  managerIds: string[]
  attachment: File | null
}

export const leaveApplicationFormSchema = z
  .object({
    leaveType: z.union([leaveTypeSchema, z.literal('')]),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string(),
    managerIds: z.array(z.string()),
    attachment: z.custom<File | null>((v) => v === null || v instanceof File),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    if (!v.leaveType) issue('leaveType', 'Choose a leave type.')
    const validStart = dateKeySchema.safeParse(v.startDate).success
    const validEnd = dateKeySchema.safeParse(v.endDate).success
    if (!validStart) issue('startDate', 'Choose a start date.')
    if (!validEnd) issue('endDate', 'Choose an end date.')
    if (validStart && validEnd) {
      if (v.endDate < v.startDate)
        issue('endDate', 'The end date must be on or after the start date.')
      else if (leaveYearOf(v.startDate) !== leaveYearOf(v.endDate))
        issue('endDate', 'A request must stay within one leave year. Split it into two requests.')
      else if (leaveDays(v.startDate, v.endDate) === 0)
        issue('endDate', 'These dates contain no working days (Monday to Friday).')
    }
    if (v.reason.trim().length < LEAVE_POLICY.reasonMinLength)
      issue('reason', `Give a reason (at least ${LEAVE_POLICY.reasonMinLength} characters).`)
    if (v.attachment) {
      const problem = attachmentProblem(v.attachment)
      if (problem) issue('attachment', ATTACHMENT_MESSAGES[problem])
    }
  })
  .transform((v): LeaveApplicationInput => ({
    leaveType: v.leaveType as LeaveType,
    startDate: v.startDate,
    endDate: v.endDate,
    requestedDays: leaveDays(v.startDate, v.endDate),
    reason: v.reason.trim(),
    managerIds: v.managerIds,
    attachment: v.attachment,
  }))
export type LeaveApplicationFormValues = z.input<typeof leaveApplicationFormSchema>

export const leaveTypeOptions = (balances?: readonly LeaveBalance[]) =>
  (Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => {
    const b = balances?.find((x) => x.leaveType === t)
    return {
      value: t,
      label: b
        ? `${LEAVE_TYPE_LABELS[t]} (${b.remaining} of ${b.allocated} left)`
        : LEAVE_TYPE_LABELS[t],
    }
  })
