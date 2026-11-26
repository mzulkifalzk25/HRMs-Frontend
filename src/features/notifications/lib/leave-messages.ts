// Wording of leave notifications (P6-T05, P6-T06). Pure, so the mock and tests agree; the backend
// owns the real texts.
import type { LeaveRecipient } from './leave-recipients'

export type LeaveMessageContext = {
  employeeName: string
  /** e.g. "Annual" */
  leaveTypeLabel: string
  /** e.g. "2 Dec 2026 – 4 Dec 2026 (3 days)" */
  period: string
  /** The recipient is the person who asked for the leave. */
  forRequester: boolean
  comment?: string | null
}

export function leaveMessage(
  recipient: Pick<LeaveRecipient, 'type' | 'role'>,
  ctx: LeaveMessageContext,
): { title: string; body: string } {
  const whose = ctx.forRequester ? 'Your' : `${ctx.employeeName}’s`
  const leave = `${ctx.leaveTypeLabel} leave`
  const withComment = (text: string) => (ctx.comment ? `${text} “${ctx.comment}”` : text)
  switch (recipient.type) {
    case 'approval_required':
      return recipient.role === 'review'
        ? {
            title: `Review requested: ${ctx.employeeName}’s ${leave}`,
            body: `${ctx.period}. You can comment or recommend; the manager decides.`,
          }
        : {
            title: `Decision needed: ${ctx.employeeName}’s ${leave}`,
            body: `${ctx.period}.`,
          }
    case 'leave_submitted':
      return { title: `${ctx.employeeName} requested ${leave}`, body: `${ctx.period}.` }
    case 'leave_approved':
      return { title: `${whose} ${leave} was approved`, body: withComment(`${ctx.period}.`) }
    case 'leave_declined':
      return { title: `${whose} ${leave} was declined`, body: withComment(`${ctx.period}.`) }
    case 'leave_cancelled':
      return { title: `${ctx.employeeName} cancelled ${leave}`, body: `${ctx.period}.` }
    default:
      return { title: `${ctx.employeeName}: ${leave}`, body: `${ctx.period}.` }
  }
}
