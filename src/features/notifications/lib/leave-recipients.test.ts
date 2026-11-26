import { describe, expect, it } from 'vitest'
import { leaveEventRecipients, type LeaveEventContext } from './leave-recipients'

const ctx = (extra: Partial<LeaveEventContext> = {}): LeaveEventContext => ({
  requesterId: 'emp',
  deciderIds: ['mgr'],
  reviewerIds: ['tl', 'apm'],
  hrIds: ['hr', 'hr2'],
  actorId: 'emp',
  ...extra,
})

describe('leave notification recipients (D-064, D-089)', () => {
  it('submission: deciders decide, reviewers review, HR is told', () => {
    expect(leaveEventRecipients('submitted', ctx())).toEqual([
      { employeeId: 'mgr', type: 'approval_required', role: 'decide' },
      { employeeId: 'tl', type: 'approval_required', role: 'review' },
      { employeeId: 'apm', type: 'approval_required', role: 'review' },
      { employeeId: 'hr', type: 'leave_submitted' },
      { employeeId: 'hr2', type: 'leave_submitted' },
    ])
  })

  it('routed to HR: HR gets the actionable notification once', () => {
    const r = leaveEventRecipients('submitted', ctx({ deciderIds: ['hr', 'hr2'], reviewerIds: [] }))
    expect(r).toEqual([
      { employeeId: 'hr', type: 'approval_required', role: 'decide' },
      { employeeId: 'hr2', type: 'approval_required', role: 'decide' },
    ])
  })

  it.each(['approved', 'declined'] as const)('%s: requester and HR, never the actor', (event) => {
    const type = event === 'approved' ? 'leave_approved' : 'leave_declined'
    expect(leaveEventRecipients(event, ctx({ actorId: 'mgr' }))).toEqual([
      { employeeId: 'emp', type },
      { employeeId: 'hr', type },
      { employeeId: 'hr2', type },
    ])
    // HR override: the other HR Administrator is still told
    expect(leaveEventRecipients(event, ctx({ actorId: 'hr' })).map((r) => r.employeeId)).toEqual([
      'emp',
      'hr2',
    ])
  })

  it('cancellation: HR always; approvers only while it was pending', () => {
    expect(
      leaveEventRecipients('cancelled', ctx({ wasPending: true })).map((r) => r.employeeId),
    ).toEqual(['hr', 'hr2', 'mgr', 'tl', 'apm'])
    expect(
      leaveEventRecipients('cancelled', ctx({ wasPending: false })).map((r) => r.employeeId),
    ).toEqual(['hr', 'hr2'])
  })

  it('HR is in the recipients of every lifecycle event', () => {
    for (const event of ['submitted', 'approved', 'declined', 'cancelled'] as const) {
      const ids = leaveEventRecipients(event, ctx({ actorId: 'mgr' })).map((r) => r.employeeId)
      expect(ids).toEqual(expect.arrayContaining(['hr', 'hr2']))
    }
  })
})
