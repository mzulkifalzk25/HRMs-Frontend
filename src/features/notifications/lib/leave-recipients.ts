// Who is notified about a leave event (P6-T05, P6-T06; D-064, D-089). Pure; the backend resolves
// recipients the same way.
//
//   submitted          → decision-makers: "approval required" (decide); reviewers: "approval
//                        required" (review); HR: "leave submitted"
//   approved/declined  → requester and HR (also HR overrides)
//   cancelled          → HR, plus decision-makers and reviewers while it was still pending
//
// HR Administrators are always included (D-064); the person who acted is never notified of their
// own action. One notification per person and event (the most actionable type wins).
import type { NotificationType } from './notification-types'

export type LeaveEvent = 'submitted' | 'approved' | 'declined' | 'cancelled'

export type LeaveEventContext = {
  requesterId: string
  deciderIds: readonly string[]
  reviewerIds: readonly string[]
  /** HR Administrators (always notified, D-064). */
  hrIds: readonly string[]
  /** Who caused the event (requester for submit/cancel, decider or HR for decisions). */
  actorId: string
  /** Status before a cancellation, to know whether approvers were still waiting. */
  wasPending?: boolean
}

export type LeaveRecipient = {
  employeeId: string
  type: NotificationType
  /** For approval-required notifications: decide or review. */
  role?: 'decide' | 'review'
}

export function leaveEventRecipients(event: LeaveEvent, ctx: LeaveEventContext): LeaveRecipient[] {
  const result = new Map<string, LeaveRecipient>()
  const add = (employeeId: string, recipient: Omit<LeaveRecipient, 'employeeId'>) => {
    if (employeeId === ctx.actorId || result.has(employeeId)) return
    result.set(employeeId, { employeeId, ...recipient })
  }
  switch (event) {
    case 'submitted':
      ctx.deciderIds.forEach((id) => add(id, { type: 'approval_required', role: 'decide' }))
      ctx.reviewerIds.forEach((id) => add(id, { type: 'approval_required', role: 'review' }))
      ctx.hrIds.forEach((id) => add(id, { type: 'leave_submitted' }))
      break
    case 'approved':
    case 'declined': {
      const type = event === 'approved' ? 'leave_approved' : 'leave_declined'
      add(ctx.requesterId, { type })
      ctx.hrIds.forEach((id) => add(id, { type }))
      break
    }
    case 'cancelled':
      ctx.hrIds.forEach((id) => add(id, { type: 'leave_cancelled' }))
      if (ctx.wasPending) {
        ctx.deciderIds.forEach((id) => add(id, { type: 'leave_cancelled' }))
        ctx.reviewerIds.forEach((id) => add(id, { type: 'leave_cancelled' }))
      }
      break
  }
  return [...result.values()]
}
