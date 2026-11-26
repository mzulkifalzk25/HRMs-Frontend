// In-memory leave "backend" for mock mode (P5-T04, D-080). FICTIONAL data. It applies the same
// pure rules as the UI (features/leave/lib: routing, workflow, balance, duration) and behaves like
// a server: validation with field errors (400), scope (404 outside it), HR-only allocation changes
// (403), optimistic concurrency (409 `conflict` on a stale version), idempotent decisions
// (409 `already_decided`), no negative balances (409 `insufficient_balance` at approval) and an
// append-only ledger with exactly one deduction per approved request (D-069).
import type { MockViewer } from './mock-session'
import { balanceOf, computeBalances } from '@/features/leave/lib/balance'
import { isLeaveWorkingDay, leaveDays, rangesOverlap } from '@/features/leave/lib/duration'
import {
  attachmentProblem,
  ATTACHMENT_MESSAGES,
  LEAVE_POLICY,
  leaveYearOf,
} from '@/features/leave/lib/leave-policy'
import { routeLeaveRequest, type LeaveRoute } from '@/features/leave/lib/routing'
import {
  allowedActions,
  deriveStatus,
  evaluateWorkflow,
  REASON_REQUIRED,
  stageFor,
  type ActionKind,
} from '@/features/leave/lib/workflow'
import type {
  ActionInput,
  AllocationAdjustment,
  ApprovalAction,
  ApprovalStep,
  ApprovalTask,
  InboxTab,
  LeaveBalance,
  LeaveListQuery,
  LeaveRequest,
  LeaveRequestDetail,
  LeaveSummary,
  LedgerEntry,
  Participant,
  RoutePreview,
} from '@/features/leave/schemas/leave.schema'
import { leaveMessage } from '@/features/notifications/lib/leave-messages'
import {
  leaveEventRecipients,
  type LeaveEvent,
} from '@/features/notifications/lib/leave-recipients'
import { notificationLink } from '@/features/notifications/lib/notification-types'
import {
  appDateKey,
  appWallClockToInstant,
  formatDateKey,
  shiftDateKey,
  toAppIsoString,
} from '@/lib/datetime'
import { ApiError } from '@/services/api'
import type { Page } from '@/types/api'
import { LEAVE_TYPE_LABELS, LEAVE_TYPES, ANNUAL_LEAVE_ALLOWANCE, type LeaveType } from '@/types/hr'
import { mockHrStore, type HrStore } from './hr-store'
import { getMockViewer } from './mock-session'
import { mockAuditStore } from './audit-store'
import { mockNotificationStore, type NotificationStore } from './notification-store'
import { mockSettingsStore } from './settings-store'

type Attachment = LeaveRequest['attachment']

type StoredRequest = Omit<LeaveRequestDetail, 'status' | 'allowedActions'>

export type MockLeaveApplication = {
  leaveType: LeaveType
  startDate: string
  endDate: string
  requestedDays: number
  reason: string
  managerIds: string[]
  attachment: Attachment
}

const OPEN_STATUSES = new Set(['pending', 'under_review', 'pending_final_approval'])
const DECIDING = new Set<ActionKind>(['approve', 'decline', 'override_approve', 'override_decline'])

const err = (
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) => new ApiError({ status, code, message, fieldErrors })
const notFound = () => err(404, 'not_found', 'The requested item was not found.')
const forbidden = () => err(403, 'forbidden', 'You do not have permission to do this.')
const invalid = (fieldErrors: Record<string, string[]>) =>
  err(400, 'validation_error', 'Some fields are not valid.', fieldErrors)

/** Seeded requests: [requester, type, start (working days from today), length, outcome, actor, note]. */
type SeedRequest = [
  string,
  LeaveType,
  number,
  number,
  'pending' | 'approved' | 'declined' | 'recommended',
  string?,
  string?,
]
const SEED_REQUESTS: SeedRequest[] = [
  ['u-emp-001', 'casual', -20, 1, 'approved', 'u-mgr-001', 'Enjoy the day off.'],
  [
    'u-emp-001',
    'annual',
    -12,
    2,
    'declined',
    'u-mgr-001',
    'Release week; please choose other dates.',
  ],
  ['e-101', 'annual', 5, 3, 'recommended', 'u-tl-001', 'Coverage arranged with the team.'],
  ['e-103', 'casual', 3, 1, 'pending'],
  ['e-105', 'medical_sick', -3, 2, 'approved', 'e-104'],
  ['e-102', 'annual', -1, 3, 'approved', 'u-mgr-001'],
  ['e-108', 'annual', 8, 2, 'pending'],
  ['e-112', 'casual', 4, 1, 'pending'],
  ['e-107', 'medical_sick', 2, 1, 'pending'],
  ['e-110', 'casual', -8, 1, 'approved', 'e-109'],
  ['u-tl-001', 'annual', 10, 2, 'pending'],
]

const REASONS: Record<LeaveType, string> = {
  medical_sick: 'Doctor advised rest.',
  casual: 'Family commitment.',
  annual: 'Family trip planned in advance.',
}

export function createLeaveStore(
  options: { hr?: HrStore; now?: () => Date; notifications?: NotificationStore } = {},
) {
  const hr = options.hr ?? mockHrStore
  const now = options.now ?? (() => new Date())
  const notifications = options.notifications ?? mockNotificationStore
  let requests: StoredRequest[] = []
  let ledger: LedgerEntry[] = []
  let counter = 0
  /** True while seeding: seed data is not audited (it never happened in this session). */
  let seeding = false

  const todayKey = () => appDateKey(now())
  const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`
  /** A seed timestamp, never later than now. */
  const at = (dateKey: string, time: string) =>
    toAppIsoString(
      new Date(Math.min(appWallClockToInstant(dateKey, time).getTime(), now().getTime() - 60_000)),
    )

  function viewer(): MockViewer {
    const v = getMockViewer()
    if (!v) throw err(401, 'unauthorized', 'Your session has expired. Please sign in again.')
    return v
  }
  const org = () => hr.leaveOrg()
  const personOf = (id: string) => org().people.find((p) => p.id === id)
  const nameOf = (id: string) => personOf(id)?.name ?? 'Unknown'

  function participantsFor(route: LeaveRoute): Participant[] {
    return [
      ...route.deciderIds.map((id) => ({ id, kind: 'decision_maker' as const, mandatory: false })),
      ...route.reviewerIds.map((id) => ({ id, kind: 'reviewer' as const, mandatory: false })),
      ...route.mandatoryRecipientIds.map((id) => ({
        id,
        kind: 'recipient' as const,
        mandatory: true,
      })),
    ].map((p) => ({ employeeId: p.id, name: nameOf(p.id), kind: p.kind, mandatory: p.mandatory }))
  }

  function stepsFor(route: LeaveRoute): ApprovalStep[] {
    const steps: ApprovalStep[] = []
    if (route.reviewerIds.length > 0) {
      steps.push({
        id: 'review',
        kind: 'review',
        mode: 'parallel',
        completion: 'all',
        required: mockSettingsStore.peek().approvals.reviewRequired, // optional by default (D-089)
        assigneeIds: route.reviewerIds,
      })
    }
    // Several managers: any one decides by default (D-089); HR may choose another rule (D-067).
    const rule = mockSettingsStore.peek().approvals.decisionRule
    steps.push({
      id: 'decision',
      kind: 'decision',
      mode: rule === 'sequential' ? 'sequential' : 'parallel',
      completion: rule === 'any' ? 'any' : 'all',
      required: true,
      assigneeIds: route.deciderIds,
    })
    return steps
  }

  const statusOf = (r: StoredRequest) => deriveStatus(r.steps, r.actions)

  const balancesOf = (employeeId: string, year: number) => {
    ensureAllocated(employeeId, year)
    return computeBalances(ledger, employeeId, year)
  }

  /** First allocation for people without one this year, from the HR default (D-062). */
  function ensureAllocated(employeeId: string, year: number) {
    const person = personOf(employeeId)
    if (person?.status !== 'active') return
    if (
      ledger.some((e) => e.employeeId === employeeId && e.year === year && e.kind === 'allocation')
    )
      return
    const defaults = mockSettingsStore.peek().defaultAllocation
    for (const leaveType of LEAVE_TYPES) {
      ledgerEntry({
        employeeId,
        leaveType,
        year,
        kind: 'allocation',
        days: defaults[leaveType],
        reason: `Annual allocation ${year}`,
        actorName: 'System',
        at: toAppIsoString(now()),
        requestId: null,
      })
    }
  }

  function scopeCheck(v: MockViewer) {
    const scope = v.role === 'employee' ? new Set<string>() : hr.visibleEmployeeIds()
    return (r: StoredRequest) =>
      r.employeeId === v.id ||
      scope === null ||
      scope.has(r.employeeId) ||
      r.participants.some((p) => p.employeeId === v.id)
  }

  function allowedFor(r: StoredRequest, v: MockViewer) {
    return allowedActions({
      steps: r.steps,
      actions: r.actions,
      requesterId: r.employeeId,
      startDate: r.startDate,
      today: todayKey(),
      viewer: { id: v.id, role: v.role },
    })
  }

  function toSummary(r: StoredRequest): LeaveRequest {
    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      departmentName: r.departmentName,
      leaveType: r.leaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      requestedDays: r.requestedDays,
      reason: r.reason,
      status: statusOf(r),
      backdated: r.backdated,
      attachment: r.attachment,
      submittedAt: r.submittedAt,
    }
  }

  const toDetail = (r: StoredRequest, v: MockViewer): LeaveRequestDetail => ({
    ...r,
    ...toSummary(r),
    steps: r.steps.map((s) => ({ ...s, assigneeIds: [...s.assigneeIds] })),
    participants: r.participants.map((p) => ({ ...p })),
    actions: r.actions.map((a) => ({ ...a })),
    allowedActions: allowedFor(r, v),
  })

  function ledgerEntry(entry: Omit<LedgerEntry, 'id'>): LedgerEntry {
    const created = { id: nextId('led'), ...entry }
    ledger.push(created)
    const viewer = getMockViewer()
    if (!seeding && viewer && entry.kind !== 'allocation') {
      const person = personOf(entry.employeeId)
      const sign = entry.kind === 'deduction' ? -entry.days : entry.days
      mockAuditStore.record({
        actorId: viewer.id,
        actorName: entry.actorName,
        action: 'adjusted',
        entity: 'leave_balance',
        entityId: created.id,
        entityLabel: `${person?.name ?? entry.employeeId}, ${LEAVE_TYPE_LABELS[entry.leaveType]} ${entry.year}`,
        reason: entry.reason,
        before: null,
        after: { Change: `${sign > 0 ? '+' : ''}${sign} days`, Kind: entry.kind },
      })
    }
    return created
  }

  /** Records the outcome in the ledger; never deducts the same request twice (D-069). */
  function settle(r: StoredRequest, before: string, actorName: string, atIso: string) {
    const after = statusOf(r)
    const year = leaveYearOf(r.startDate)
    const has = (kind: LedgerEntry['kind']) =>
      ledger.some((e) => e.requestId === r.id && e.kind === kind)
    if (after === 'approved' && before !== 'approved' && !has('deduction')) {
      ledgerEntry({
        employeeId: r.employeeId,
        leaveType: r.leaveType,
        year,
        kind: 'deduction',
        days: r.requestedDays,
        reason: `Approved leave ${r.startDate} to ${r.endDate}`,
        actorName,
        at: atIso,
        requestId: r.id,
      })
    }
    if (after === 'cancelled' && before === 'approved' && has('deduction') && !has('reversal')) {
      ledgerEntry({
        employeeId: r.employeeId,
        leaveType: r.leaveType,
        year,
        kind: 'reversal',
        days: r.requestedDays,
        reason: 'Approved leave cancelled before it started',
        actorName,
        at: atIso,
        requestId: r.id,
      })
    }
  }

  /**
   * Leave lifecycle notifications (P6-T05, P6-T06, D-064): HR always, approvers on submission,
   * the requester on decisions. Seeded events older than a day arrive already read.
   */
  function emit(
    event: LeaveEvent,
    r: StoredRequest,
    actorId: string,
    at: string,
    extra: { wasPending?: boolean; comment?: string | null } = {},
  ) {
    const people = org().people
    const assignees = (kind: 'decision' | 'review') =>
      r.steps.filter((s) => s.kind === kind).flatMap((s) => s.assigneeIds)
    const recipients = leaveEventRecipients(event, {
      requesterId: r.employeeId,
      deciderIds: assignees('decision'),
      reviewerIds: assignees('review'),
      hrIds: people.filter((p) => p.role === 'hr_admin' && p.status === 'active').map((p) => p.id),
      actorId,
      wasPending: extra.wasPending,
    })
    const range =
      r.startDate === r.endDate
        ? formatDateKey(r.startDate)
        : `${formatDateKey(r.startDate)} – ${formatDateKey(r.endDate)}`
    const period = `${range} (${r.requestedDays} ${r.requestedDays === 1 ? 'day' : 'days'})`
    const read = new Date(at).getTime() < now().getTime() - 86_400_000
    for (const recipient of recipients) {
      notifications.notify({
        recipientId: recipient.employeeId,
        type: recipient.type,
        ...leaveMessage(recipient, {
          employeeName: r.employeeName,
          leaveTypeLabel: LEAVE_TYPE_LABELS[r.leaveType],
          period,
          forRequester: recipient.employeeId === r.employeeId,
          comment: extra.comment,
        }),
        link: notificationLink({ kind: 'leave_request', id: r.id }),
        actorName: nameOf(actorId),
        at,
        read,
      })
    }
  }

  /** Notifies a final decision once (approve/decline, incl. HR overrides). */
  function emitDecision(
    r: StoredRequest,
    before: string,
    actorId: string,
    at: string,
    comment: string | null,
  ) {
    const after = statusOf(r)
    if (before === after || (after !== 'approved' && after !== 'declined')) return
    if (!seeding)
      mockAuditStore.record({
        actorId,
        actorName: nameOf(actorId),
        action: after,
        entity: 'leave_request',
        entityId: r.id,
        entityLabel: `${r.employeeName}, ${LEAVE_TYPE_LABELS[r.leaveType]} ${r.startDate} to ${r.endDate}`,
        reason: comment,
        before: { Status: before },
        after: { Status: after },
      })
    emit(after === 'approved' ? 'approved' : 'declined', r, actorId, at, { comment })
  }

  function create(
    requesterId: string,
    input: MockLeaveApplication,
    route: LeaveRoute,
    submittedAt: string,
  ): StoredRequest {
    const person = personOf(requesterId)
    const request: StoredRequest = {
      id: nextId('lr'),
      employeeId: requesterId,
      employeeName: person?.name ?? 'Unknown',
      departmentName: person?.departmentName ?? null,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      requestedDays: input.requestedDays,
      reason: input.reason,
      backdated: input.startDate < submittedAt.slice(0, 10),
      attachment: input.attachment,
      submittedAt,
      version: 0,
      routedTo: route.target,
      steps: stepsFor(route),
      participants: participantsFor(route),
      actions: [],
    }
    requests.push(request)
    emit('submitted', request, requesterId, submittedAt)
    return request
  }

  /** The step an action belongs to (decisions and recommendations; others are request-level). */
  function stepIdFor(r: StoredRequest, actorId: string, kind: ActionKind): string | null {
    const stepKind =
      kind === 'approve' || kind === 'decline'
        ? 'decision'
        : kind === 'recommend_approve' || kind === 'recommend_decline'
          ? 'review'
          : null
    if (!stepKind) return null
    return r.steps.find((s) => s.kind === stepKind && s.assigneeIds.includes(actorId))?.id ?? null
  }

  function addAction(
    r: StoredRequest,
    actorId: string,
    kind: ActionKind,
    comment: string | null,
    atIso: string,
  ): ApprovalAction {
    const stepId = stepIdFor(r, actorId, kind)
    const action: ApprovalAction = {
      id: nextId('act'),
      stepId,
      actorId,
      actorName: nameOf(actorId),
      kind,
      comment,
      at: atIso,
    }
    r.actions.push(action)
    r.version += 1
    return action
  }

  /** n working days from `from` (0 = `from` itself or the next working day). */
  function workday(from: string, n: number): string {
    let d = from
    if (n === 0) {
      while (!isLeaveWorkingDay(d)) d = shiftDateKey(d, 1)
      return d
    }
    const step = n > 0 ? 1 : -1
    for (let count = 0; count < Math.abs(n);) {
      d = shiftDateKey(d, step)
      if (isLeaveWorkingDay(d)) count += 1
    }
    return d
  }

  function seed() {
    seeding = true
    requests = []
    ledger = []
    counter = 0
    const today = todayKey()
    const year = leaveYearOf(today)
    for (const p of org().people) {
      if (p.status !== 'active') continue
      for (const leaveType of LEAVE_TYPES) {
        ledgerEntry({
          employeeId: p.id,
          leaveType,
          year,
          kind: 'allocation',
          days: ANNUAL_LEAVE_ALLOWANCE[leaveType],
          reason: `Annual allocation ${year}`,
          actorName: 'System',
          at: at(`${year}-01-01`, '09:00'),
          requestId: null,
        })
      }
    }
    for (const [requesterId, leaveType, offset, length, outcome, actorId, note] of SEED_REQUESTS) {
      const startDate = workday(today, offset)
      const endDate = workday(startDate, length - 1)
      if (leaveYearOf(startDate) !== year || leaveYearOf(endDate) !== year) continue
      const route = routeLeaveRequest(requesterId, org())
      // Backdated sick leave is submitted after it ended; everything else a few days before.
      const submittedDay =
        leaveType === 'medical_sick' && offset < 0
          ? shiftDateKey(endDate, 1)
          : shiftDateKey(startDate, -4)
      const request = create(
        requesterId,
        {
          leaveType,
          startDate,
          endDate,
          requestedDays: leaveDays(startDate, endDate),
          reason: REASONS[leaveType],
          managerIds: route.deciderIds,
          attachment: null,
        },
        route,
        at(submittedDay, '10:15'),
      )
      if (outcome === 'pending' || !actorId) continue
      const kind: ActionKind =
        outcome === 'approved'
          ? 'approve'
          : outcome === 'declined'
            ? 'decline'
            : 'recommend_approve'
      const before = statusOf(request)
      const actionAt = at(shiftDateKey(submittedDay, 1), '11:30')
      addAction(request, actorId, kind, note ?? null, actionAt)
      settle(request, before, nameOf(actorId), actionAt)
      emitDecision(request, before, actorId, actionAt, note ?? null)
    }
    seeding = false
  }
  seed()

  function find(id: string, v: MockViewer): StoredRequest {
    const r = requests.find((x) => x.id === id)
    if (!r || !scopeCheck(v)(r)) throw notFound()
    return r
  }

  function validate(v: MockViewer, input: MockLeaveApplication) {
    const errors: Record<string, string[]> = {}
    const set = (field: string, message: string) => {
      errors[field] ??= [message]
    }
    if (!LEAVE_TYPES.includes(input.leaveType)) set('leaveType', 'Choose a leave type.')
    const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
    if (!dateOk(input.startDate)) set('startDate', 'Choose a start date.')
    if (!dateOk(input.endDate)) set('endDate', 'Choose an end date.')
    let days = 0
    if (!errors.startDate && !errors.endDate) {
      if (input.endDate < input.startDate)
        set('endDate', 'The end date must be on or after the start date.')
      else if (leaveYearOf(input.startDate) !== leaveYearOf(input.endDate))
        set('endDate', 'A request must stay within one leave year. Split it into two requests.')
      else {
        days = leaveDays(input.startDate, input.endDate, mockSettingsStore.holidaySet())
        if (days === 0)
          set('endDate', 'These dates contain no working days (Monday to Friday, not a holiday).')
        else if (input.requestedDays !== days)
          set('requestedDays', `The duration does not match the dates (${days} working days).`)
      }
    }
    if (input.reason.trim().length < LEAVE_POLICY.reasonMinLength)
      set('reason', `Give a reason (at least ${LEAVE_POLICY.reasonMinLength} characters).`)
    if (input.attachment) {
      const problem = attachmentProblem({ ...input.attachment, type: input.attachment.contentType })
      if (problem) set('attachment', ATTACHMENT_MESSAGES[problem])
    }
    if (days > 0 && !errors.leaveType) {
      const clash = requests.find(
        (r) =>
          r.employeeId === v.id &&
          (OPEN_STATUSES.has(statusOf(r)) || statusOf(r) === 'approved') &&
          rangesOverlap(
            { start: r.startDate, end: r.endDate },
            { start: input.startDate, end: input.endDate },
          ),
      )
      if (clash && !LEAVE_POLICY.allowOverlap)
        set('startDate', `You already have leave from ${clash.startDate} to ${clash.endDate}.`)
      const balance = balanceOf(balancesOf(v.id, leaveYearOf(input.startDate)), input.leaveType)
      if (days > balance.remaining && !LEAVE_POLICY.allowNegativeBalance)
        set(
          'leaveType',
          `Only ${balance.remaining} ${LEAVE_TYPE_LABELS[input.leaveType]} ${balance.remaining === 1 ? 'day remains' : 'days remain'}.`,
        )
    }
    return errors
  }

  return {
    reset: seed,

    // --- Imports (P7, D-096; mock backend only) ---------------------------------------------
    hasOverlap(employeeId: string, startDate: string, endDate: string): boolean {
      return requests.some(
        (r) =>
          r.employeeId === employeeId &&
          (OPEN_STATUSES.has(statusOf(r)) || statusOf(r) === 'approved') &&
          rangesOverlap({ start: r.startDate, end: r.endDate }, { start: startDate, end: endDate }),
      )
    },
    balanceFor(employeeId: string, leaveType: LeaveType, year: number) {
      return balanceOf(balancesOf(employeeId, year), leaveType)
    },
    /** Historical leave: an approved request with its deduction, no notifications. */
    importHistory(input: {
      employeeId: string
      leaveType: LeaveType
      startDate: string
      endDate: string
      reason: string
      actorId: string
    }) {
      const person = personOf(input.employeeId)
      if (!person) throw notFound()
      const at = toAppIsoString(now())
      const r: StoredRequest = {
        id: nextId('lr'),
        employeeId: input.employeeId,
        employeeName: person.name,
        departmentName: person.departmentName,
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        requestedDays: leaveDays(input.startDate, input.endDate),
        reason: input.reason,
        backdated: true,
        attachment: null,
        submittedAt: at,
        version: 0,
        routedTo: 'hr',
        steps: [],
        participants: [],
        actions: [],
      }
      requests.push(r)
      addAction(r, input.actorId, 'override_approve', 'Imported historical leave', at)
      settle(r, 'pending', nameOf(input.actorId), at)
      return r.id
    },
    /** Sets the allocation through an "Imported opening balance" adjustment. */
    importBalance(input: {
      employeeId: string
      leaveType: LeaveType
      year: number
      allocated: number
      actorId: string
    }) {
      const current = balanceOf(balancesOf(input.employeeId, input.year), input.leaveType)
      const days = input.allocated - current.allocated
      if (days === 0) return null
      return ledgerEntry({
        employeeId: input.employeeId,
        leaveType: input.leaveType,
        year: input.year,
        kind: 'adjustment',
        days,
        reason: `Imported opening balance (${input.allocated} days)`,
        actorName: nameOf(input.actorId),
        at: toAppIsoString(now()),
        requestId: null,
      })
    },

    /** Approved leave on a working day (for attendance summaries). */
    isOnLeave(employeeId: string, date: string): boolean {
      return (
        isLeaveWorkingDay(date) &&
        requests.some(
          (r) =>
            r.employeeId === employeeId &&
            r.startDate <= date &&
            r.endDate >= date &&
            statusOf(r) === 'approved',
        )
      )
    },

    balances({ employeeId, year }: { employeeId?: string; year: number }): LeaveBalance[] {
      const v = viewer()
      const target = employeeId ?? v.id
      if (target !== v.id && v.role !== 'hr_admin') throw forbidden()
      if (!personOf(target)) throw notFound()
      return balancesOf(target, year)
    },

    ledger({ employeeId, year }: { employeeId?: string; year: number }): LedgerEntry[] {
      const v = viewer()
      const target = employeeId ?? v.id
      if (target !== v.id && v.role !== 'hr_admin') throw forbidden()
      if (!personOf(target)) throw notFound()
      ensureAllocated(target, year)
      return ledger
        .filter((e) => e.employeeId === target && e.year === year)
        .map((e) => ({ ...e }))
        .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
    },

    adjustAllocation(input: AllocationAdjustment): LedgerEntry {
      const v = viewer()
      if (v.role !== 'hr_admin') throw forbidden()
      const person = personOf(input.employeeId)
      if (!person || person.status === 'inactive') throw notFound()
      const errors: Record<string, string[]> = {}
      if (!Number.isInteger(input.days) || input.days === 0)
        errors.days = ['Enter a whole number of days other than 0.']
      if (input.reason.trim().length < LEAVE_POLICY.reasonMinLength)
        errors.reason = [`Give a reason (at least ${LEAVE_POLICY.reasonMinLength} characters).`]
      const current = balanceOf(balancesOf(input.employeeId, input.year), input.leaveType)
      if (!errors.days && current.allocated + input.days < current.used)
        errors.days = [`This would leave fewer days than already used (${current.used}).`]
      if (Object.keys(errors).length > 0) throw invalid(errors)
      return {
        ...ledgerEntry({
          employeeId: input.employeeId,
          leaveType: input.leaveType,
          year: input.year,
          kind: 'adjustment',
          days: input.days,
          reason: input.reason.trim(),
          actorName: nameOf(v.id),
          at: toAppIsoString(now()),
          requestId: null,
        }),
      }
    },

    previewRoute(managerIds: readonly string[] | null): RoutePreview {
      const v = viewer()
      const route = routeLeaveRequest(v.id, org(), managerIds ?? undefined)
      return {
        routedTo: route.target,
        managerChoices: route.managerChoices,
        participants: participantsFor(route),
        problem: route.problem,
      }
    },

    mine(): LeaveRequest[] {
      const v = viewer()
      return requests
        .filter((r) => r.employeeId === v.id)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .map(toSummary)
    },

    submit(input: MockLeaveApplication): LeaveRequestDetail {
      const v = viewer()
      const errors = validate(v, input)
      const route = routeLeaveRequest(v.id, org(), input.managerIds)
      if (route.target === 'managers') {
        const choices = new Set(route.managerChoices.map((m) => m.id))
        if (input.managerIds.length === 0) errors.managerIds = ['Choose at least one manager.']
        else if (input.managerIds.some((id) => !choices.has(id)))
          errors.managerIds = ['Choose from your own managers.']
      }
      if (Object.keys(errors).length > 0) throw invalid(errors)
      if (route.problem) throw err(400, 'no_approver', route.problem)
      const request = create(
        v.id,
        { ...input, reason: input.reason.trim() },
        route,
        toAppIsoString(now()),
      )
      return toDetail(request, v)
    },

    list(query: LeaveListQuery): Page<LeaveRequest> {
      const v = viewer()
      if (v.role === 'employee') throw forbidden()
      const visible = scopeCheck(v)
      const people = new Map(org().people.map((p) => [p.id, p]))
      let rows = requests.filter(visible)
      if (query.status) rows = rows.filter((r) => statusOf(r) === query.status)
      if (query.leaveType) rows = rows.filter((r) => r.leaveType === query.leaveType)
      if (query.employeeId) rows = rows.filter((r) => r.employeeId === query.employeeId)
      if (query.departmentId)
        rows = rows.filter((r) => people.get(r.employeeId)?.departmentId === query.departmentId)
      if (query.from) rows = rows.filter((r) => r.endDate >= (query.from as string))
      if (query.to) rows = rows.filter((r) => r.startDate <= (query.to as string))
      rows.sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id))
      const start = (query.page - 1) * query.pageSize
      return {
        count: rows.length,
        next: start + query.pageSize < rows.length ? `?page=${query.page + 1}` : null,
        previous: query.page > 1 ? `?page=${query.page - 1}` : null,
        results: rows.slice(start, start + query.pageSize).map(toSummary),
      }
    },

    get(id: string): LeaveRequestDetail {
      const v = viewer()
      return toDetail(find(id, v), v)
    },

    inbox(tab: InboxTab): ApprovalTask[] {
      const v = viewer()
      const visible = requests.filter(scopeCheck(v)).filter((r) => r.employeeId !== v.id)
      if (tab === 'pending') {
        return visible
          .map((r) => ({ r, allowed: allowedFor(r, v) }))
          .filter(
            ({ allowed }) => allowed.includes('approve') || allowed.includes('recommend_approve'),
          )
          .sort((a, b) => a.r.submittedAt.localeCompare(b.r.submittedAt))
          .map(({ r, allowed }) => ({ ...toSummary(r), stage: stageFor(allowed) }))
      }
      const lastActionAt = (r: StoredRequest) =>
        r.actions.filter((a) => a.actorId === v.id).at(-1)?.at ?? ''
      return visible
        .filter((r) => r.actions.some((a) => a.actorId === v.id && a.kind !== 'cancel'))
        .sort((a, b) => lastActionAt(b).localeCompare(lastActionAt(a)))
        .map((r) => {
          const decider = r.steps.some((s) => s.kind === 'decision' && s.assigneeIds.includes(v.id))
          const reviewer = r.steps.some((s) => s.kind === 'review' && s.assigneeIds.includes(v.id))
          const stage = decider ? 'final_approval' : reviewer ? 'recommendation' : 'review'
          return { ...toSummary(r), stage }
        })
    },

    act(id: string, input: ActionInput): LeaveRequestDetail {
      const v = viewer()
      const r = find(id, v)
      if (input.version !== r.version)
        throw err(
          409,
          'conflict',
          'This request changed while you were looking at it. The latest version is now shown.',
        )
      const before = statusOf(r)
      const allowed = allowedFor(r, v)
      if (!allowed.includes(input.action)) {
        const decided = evaluateWorkflow(r.steps, r.actions).outcome !== 'pending'
        const alreadyActed = r.actions.some(
          (a) => a.actorId === v.id && (DECIDING.has(a.kind) || a.kind.startsWith('recommend')),
        )
        if (decided || alreadyActed)
          throw err(409, 'already_decided', 'This request has already been decided.')
        throw forbidden()
      }
      const comment = input.comment?.trim() || null
      if (
        REASON_REQUIRED.has(input.action) &&
        (comment?.length ?? 0) < LEAVE_POLICY.reasonMinLength
      )
        throw invalid({
          comment: [`Give a reason (at least ${LEAVE_POLICY.reasonMinLength} characters).`],
        })
      // Approval must still fit the balance (pending requests do not reserve days, D-088).
      const projected = evaluateWorkflow(r.steps, [
        ...r.actions,
        { actorId: v.id, kind: input.action, stepId: stepIdFor(r, v.id, input.action) },
      ])
      const wouldApprove = projected.outcome === 'approved' && before !== 'approved'
      if (wouldApprove) {
        const balance = balanceOf(balancesOf(r.employeeId, leaveYearOf(r.startDate)), r.leaveType)
        if (balance.remaining < r.requestedDays)
          throw err(
            409,
            'insufficient_balance',
            `Only ${balance.remaining} ${LEAVE_TYPE_LABELS[r.leaveType]} days remain, so this request cannot be approved.`,
          )
      }
      const nowIso = toAppIsoString(now())
      addAction(r, v.id, input.action, comment, nowIso)
      settle(r, before, nameOf(v.id), nowIso)
      emitDecision(r, before, v.id, nowIso, comment)
      return toDetail(r, v)
    },

    cancel(id: string, input: { reason: string | null; version: number }): LeaveRequestDetail {
      const v = viewer()
      const r = find(id, v)
      if (r.employeeId !== v.id) throw forbidden()
      if (input.version !== r.version)
        throw err(
          409,
          'conflict',
          'This request changed while you were looking at it. The latest version is now shown.',
        )
      if (!allowedFor(r, v).includes('cancel'))
        throw err(409, 'cannot_cancel', 'This request can no longer be cancelled.')
      const before = statusOf(r)
      const nowIso = toAppIsoString(now())
      addAction(r, v.id, 'cancel', input.reason?.trim() || null, nowIso)
      settle(r, before, nameOf(v.id), nowIso)
      emit('cancelled', r, v.id, nowIso, { wasPending: before !== 'approved' })
      mockAuditStore.record({
        actorId: v.id,
        actorName: nameOf(v.id),
        action: 'cancelled',
        entity: 'leave_request',
        entityId: r.id,
        entityLabel: `${r.employeeName}, ${LEAVE_TYPE_LABELS[r.leaveType]} ${r.startDate} to ${r.endDate}`,
        reason: input.reason?.trim() || null,
        before: { Status: before },
        after: { Status: 'cancelled' },
      })
      return toDetail(r, v)
    },

    summary(): LeaveSummary {
      const v = viewer()
      const today = todayKey()
      const month = today.slice(0, 7)
      const visible = requests
        .filter(scopeCheck(v))
        .filter((r) => r.employeeId !== v.id || v.role === 'employee')
      const approved = visible.filter((r) => statusOf(r) === 'approved')
      return {
        pending: visible.filter((r) => OPEN_STATUSES.has(statusOf(r))).length,
        approvedThisMonth: approved.filter((r) => r.startDate.slice(0, 7) === month).length,
        onLeaveToday: new Set(
          approved
            .filter((r) => r.startDate <= today && r.endDate >= today && isLeaveWorkingDay(today))
            .map((r) => r.employeeId),
        ).size,
      }
    },
  }
}

export type LeaveStore = ReturnType<typeof createLeaveStore>

/** The shared mock store used by the registry. Tests reset it between cases. */
export const mockLeaveStore = createLeaveStore()
