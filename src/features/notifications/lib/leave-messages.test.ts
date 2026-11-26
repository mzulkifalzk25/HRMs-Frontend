import { describe, expect, it } from 'vitest'
import { leaveMessage, type LeaveMessageContext } from './leave-messages'

const ctx = (extra: Partial<LeaveMessageContext> = {}): LeaveMessageContext => ({
  employeeName: 'Hamza Kareem',
  leaveTypeLabel: 'Annual',
  period: '2 Dec 2026 – 4 Dec 2026 (3 days)',
  forRequester: false,
  ...extra,
})

describe('leave notification texts', () => {
  it('asks decision-makers to decide and reviewers to review', () => {
    expect(leaveMessage({ type: 'approval_required', role: 'decide' }, ctx()).title).toBe(
      'Decision needed: Hamza Kareem’s Annual leave',
    )
    expect(leaveMessage({ type: 'approval_required', role: 'review' }, ctx()).title).toBe(
      'Review requested: Hamza Kareem’s Annual leave',
    )
  })

  it('speaks to the requester directly and quotes the reason', () => {
    const declined = leaveMessage(
      { type: 'leave_declined' },
      ctx({ forRequester: true, comment: 'Release week' }),
    )
    expect(declined).toEqual({
      title: 'Your Annual leave was declined',
      body: '2 Dec 2026 – 4 Dec 2026 (3 days). “Release week”',
    })
    expect(leaveMessage({ type: 'leave_approved' }, ctx()).title).toBe(
      'Hamza Kareem’s Annual leave was approved',
    )
  })
})
