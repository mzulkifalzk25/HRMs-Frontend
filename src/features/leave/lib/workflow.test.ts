import { describe, expect, it } from 'vitest'
import {
  allowedActions,
  deriveStatus,
  evaluateWorkflow,
  stageFor,
  type ActionContext,
  type ApprovalStepConfig,
  type WorkflowAction,
} from './workflow'

const review = (extra: Partial<ApprovalStepConfig> = {}): ApprovalStepConfig => ({
  id: 'review',
  kind: 'review',
  mode: 'parallel',
  completion: 'all',
  required: false,
  assigneeIds: ['tl', 'apm'],
  ...extra,
})
const decision = (extra: Partial<ApprovalStepConfig> = {}): ApprovalStepConfig => ({
  id: 'decision',
  kind: 'decision',
  mode: 'parallel',
  completion: 'any',
  required: true,
  assigneeIds: ['m1', 'm2'],
  ...extra,
})
const act = (
  actorId: string,
  kind: WorkflowAction['kind'],
  stepId: string | null = 'decision',
) => ({
  actorId,
  kind,
  stepId,
})

const ctx = (
  steps: ApprovalStepConfig[],
  actions: WorkflowAction[],
  viewer: ActionContext['viewer'],
  extra: Partial<ActionContext> = {},
): ActionContext => ({
  steps,
  actions,
  requesterId: 'emp',
  startDate: '2026-12-01',
  today: '2026-11-25',
  viewer,
  ...extra,
})

describe('workflow: completion rules (D-067, D-089)', () => {
  it.each([
    ['parallel', 'any', [act('m2', 'approve')], 'approved'],
    ['parallel', 'any', [act('m1', 'decline')], 'declined'],
    ['parallel', 'any', [act('m1', 'approve'), act('m2', 'decline')], 'approved'], // first decides
    ['parallel', 'all', [act('m1', 'approve')], 'pending'],
    ['parallel', 'all', [act('m1', 'approve'), act('m2', 'approve')], 'approved'],
    ['parallel', 'all', [act('m2', 'decline')], 'declined'],
    ['sequential', 'all', [act('m1', 'approve')], 'pending'],
    ['sequential', 'all', [act('m1', 'approve'), act('m2', 'approve')], 'approved'],
    ['sequential', 'all', [act('m1', 'decline')], 'declined'],
  ] as const)('%s/%s with %o → %s', (mode, completion, actions, outcome) => {
    expect(evaluateWorkflow([decision({ mode, completion })], actions).outcome).toBe(outcome)
  })

  it('sequential steps let only the next person in order act', () => {
    const steps = [decision({ mode: 'sequential', completion: 'all' })]
    expect(evaluateWorkflow(steps, []).steps[0]?.pendingAssigneeIds).toEqual(['m1'])
    expect(evaluateWorkflow(steps, [act('m1', 'approve')]).steps[0]?.pendingAssigneeIds).toEqual([
      'm2',
    ])
    expect(allowedActions(ctx(steps, [], { id: 'm2', role: 'manager' }))).toEqual(['comment'])
  })

  it('parallel steps let everyone act independently', () => {
    const steps = [decision({ completion: 'all' })]
    const state = evaluateWorkflow(steps, [act('m2', 'approve')])
    expect(state.steps[0]?.pendingAssigneeIds).toEqual(['m1'])
  })

  it('optional review never blocks the decision; a required review does', () => {
    const optional = evaluateWorkflow([review(), decision()], [])
    expect(optional.steps.map((s) => s.status)).toEqual(['open', 'open'])
    const required = evaluateWorkflow([review({ required: true }), decision()], [])
    expect(required.steps.map((s) => s.status)).toEqual(['open', 'waiting'])
    const reviewed = evaluateWorkflow(
      [review({ required: true }), decision()],
      [act('tl', 'recommend_approve', 'review'), act('apm', 'recommend_decline', 'review')],
    )
    expect(reviewed.steps.map((s) => s.status)).toEqual(['complete', 'open'])
  })

  it('a recommendation never decides (Team Lead cannot override the Manager, D-065)', () => {
    const steps = [review(), decision()]
    const actions = [
      act('tl', 'recommend_decline', 'review'),
      act('apm', 'recommend_decline', 'review'),
    ]
    expect(evaluateWorkflow(steps, actions).outcome).toBe('pending')
    expect(evaluateWorkflow(steps, [...actions, act('m1', 'approve')]).outcome).toBe('approved')
  })

  it('ignores actions by people who are not assigned to the step', () => {
    expect(evaluateWorkflow([decision()], [act('tl', 'approve')]).outcome).toBe('pending')
  })

  it('an empty step is skipped; no decision step means no automatic approval', () => {
    const state = evaluateWorkflow([review({ assigneeIds: [] }), decision()], [])
    expect(state.steps[0]?.status).toBe('skipped')
    expect(evaluateWorkflow([review()], []).outcome).toBe('pending')
  })

  it('HR override decides at once; cancellation ends everything', () => {
    expect(evaluateWorkflow([decision()], [act('hr', 'override_decline', null)])).toMatchObject({
      outcome: 'declined',
      overridden: true,
    })
    expect(evaluateWorkflow([decision()], [act('emp', 'cancel', null)]).outcome).toBe('cancelled')
  })
})

describe('workflow: status', () => {
  it.each([
    [[], 'pending'],
    [[act('m1', 'comment', null)], 'under_review'],
    [[act('tl', 'recommend_approve', 'review')], 'under_review'],
    [[act('m1', 'approve')], 'approved'],
    [[act('m1', 'decline')], 'declined'],
    [[act('emp', 'cancel', null)], 'cancelled'],
  ] as const)('%o → %s', (actions, status) => {
    expect(deriveStatus([review(), decision()], actions)).toBe(status)
  })

  it('shows "pending final approval" while an all-rule step is partly approved', () => {
    expect(deriveStatus([decision({ completion: 'all' })], [act('m1', 'approve')])).toBe(
      'pending_final_approval',
    )
  })
})

describe('workflow: who may act (D-068, D-088, D-089)', () => {
  const steps = [review(), decision()]

  it('decision-makers approve or decline; reviewers recommend; both comment', () => {
    expect(allowedActions(ctx(steps, [], { id: 'm1', role: 'manager' }))).toEqual([
      'approve',
      'decline',
      'comment',
    ])
    expect(allowedActions(ctx(steps, [], { id: 'tl', role: 'team_lead' }))).toEqual([
      'recommend_approve',
      'recommend_decline',
      'comment',
    ])
    expect(stageFor(['approve', 'decline'])).toBe('final_approval')
    expect(stageFor(['recommend_approve'])).toBe('recommendation')
  })

  it('double approval is not offered (idempotency in the UI)', () => {
    const steps2 = [decision({ completion: 'all' })]
    expect(
      allowedActions(ctx(steps2, [act('m1', 'approve')], { id: 'm1', role: 'manager' })),
    ).toEqual(['comment'])
  })

  it('the requester can never approve their own request, only cancel it', () => {
    const selfSteps = [decision({ assigneeIds: ['emp', 'm1'] })]
    expect(allowedActions(ctx(selfSteps, [], { id: 'emp', role: 'manager' }))).toEqual(['cancel'])
  })

  it('HR may override with a reason when not a decision-maker; outsiders get nothing', () => {
    expect(allowedActions(ctx(steps, [], { id: 'hr', role: 'hr_admin' }))).toEqual([
      'comment',
      'override_approve',
      'override_decline',
    ])
    expect(
      allowedActions(ctx([decision({ assigneeIds: ['hr'] })], [], { id: 'hr', role: 'hr_admin' })),
    ).toEqual(['approve', 'decline', 'comment'])
    expect(allowedActions(ctx(steps, [], { id: 'stranger', role: 'employee' }))).toEqual([])
  })

  it('approved leave can be cancelled by the requester until the day before it starts', () => {
    const approved = [act('m1', 'approve')]
    const requester = { id: 'emp', role: 'employee' as const }
    expect(allowedActions(ctx(steps, approved, requester, { today: '2026-11-30' }))).toEqual([
      'cancel',
    ])
    expect(allowedActions(ctx(steps, approved, requester, { today: '2026-12-01' }))).toEqual([])
    expect(allowedActions(ctx(steps, approved, { id: 'm1', role: 'manager' }))).toEqual([])
  })

  it('nothing is possible on declined or cancelled requests', () => {
    for (const actions of [[act('m1', 'decline')], [act('emp', 'cancel', null)]]) {
      expect(allowedActions(ctx(steps, actions, { id: 'emp', role: 'employee' }))).toEqual([])
      expect(allowedActions(ctx(steps, actions, { id: 'hr', role: 'hr_admin' }))).toEqual([])
    }
  })
})
