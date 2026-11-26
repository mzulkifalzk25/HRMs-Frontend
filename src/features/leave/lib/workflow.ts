// Approval workflow engine (P5-T08…T13; D-067, D-068, D-088, D-089). Pure and deterministic.
//
// A request has ordered steps. Each step is a `review` (comment and recommend) or a `decision`
// (approve or decline) step, `parallel` or `sequential`, with a completion rule `any` or `all`
// (D-067: configurable; the default built by routing is "any one decides", D-089). A `required`
// step blocks the steps after it until it completes; optional review steps never block.
//
//   parallel + any  → the first approval or decline completes the step
//   parallel + all  → every assignee must approve; one decline declines
//   sequential      → assignees act in order; each must approve; one decline declines
//
// HR may override any pending request with a reason (D-089). Requesters never act on their own
// request except to cancel it (D-068, D-088).
import type { Role } from '@/features/authentication/types'
import type { LeaveStatus } from '@/types/hr'
import { LEAVE_POLICY } from './leave-policy'

export const STEP_KINDS = ['review', 'decision'] as const
export const STEP_MODES = ['parallel', 'sequential'] as const
export const COMPLETION_RULES = ['any', 'all'] as const

export type ApprovalStepConfig = {
  id: string
  kind: (typeof STEP_KINDS)[number]
  mode: (typeof STEP_MODES)[number]
  completion: (typeof COMPLETION_RULES)[number]
  required: boolean
  assigneeIds: readonly string[]
}

export const ACTION_KINDS = [
  'approve',
  'decline',
  'recommend_approve',
  'recommend_decline',
  'comment',
  'override_approve',
  'override_decline',
  'cancel',
] as const
export type ActionKind = (typeof ACTION_KINDS)[number]

/** Actions that must carry a written reason (D-068, D-089). */
export const REASON_REQUIRED: ReadonlySet<ActionKind> = new Set([
  'decline',
  'override_approve',
  'override_decline',
  'comment',
])

export type WorkflowAction = { actorId: string; kind: ActionKind; stepId: string | null }

export type StepStatus = 'waiting' | 'open' | 'complete' | 'skipped'
export type StepState = {
  id: string
  status: StepStatus
  outcome: 'approved' | 'declined' | null
  /** Who may act on this step now. */
  pendingAssigneeIds: string[]
}

export type WorkflowOutcome = 'pending' | 'approved' | 'declined' | 'cancelled'
export type WorkflowState = {
  outcome: WorkflowOutcome
  overridden: boolean
  steps: StepState[]
}

const DECISIONS = new Set<ActionKind>(['approve', 'decline'])
const RECOMMENDATIONS = new Set<ActionKind>(['recommend_approve', 'recommend_decline'])

function evaluateStep(step: ApprovalStepConfig, actions: readonly WorkflowAction[]) {
  const relevant = step.kind === 'decision' ? DECISIONS : RECOMMENDATIONS
  // One counted action per assignee: their first one (later duplicates are ignored).
  const firstBy = new Map<string, ActionKind>()
  for (const a of actions) {
    if (a.stepId !== step.id || !relevant.has(a.kind) || !step.assigneeIds.includes(a.actorId))
      continue
    if (!firstBy.has(a.actorId)) firstBy.set(a.actorId, a.kind)
  }
  const ordered = [...firstBy.entries()]
  const positive = step.kind === 'decision' ? 'approve' : 'recommend_approve'
  const negative = step.kind === 'decision' ? 'decline' : 'recommend_decline'
  const notYet = step.assigneeIds.filter((id) => !firstBy.has(id))

  if (step.kind === 'review') {
    // Recommendations carry no outcome: they inform the decision-makers (D-089).
    if (step.mode === 'sequential') {
      return { complete: notYet.length === 0, outcome: null, pending: notYet.slice(0, 1) }
    }
    const done = step.completion === 'any' ? ordered.length > 0 : notYet.length === 0
    return { complete: done, outcome: null, pending: done ? [] : notYet }
  }

  if (step.mode === 'parallel' && step.completion === 'any') {
    const first = ordered[0]
    if (!first) return { complete: false, outcome: null, pending: notYet }
    const outcome = first[1] === positive ? ('approved' as const) : ('declined' as const)
    return { complete: true, outcome, pending: [] }
  }
  if (ordered.some(([, kind]) => kind === negative)) {
    return { complete: true, outcome: 'declined' as const, pending: [] }
  }
  if (notYet.length === 0) return { complete: true, outcome: 'approved' as const, pending: [] }
  return {
    complete: false,
    outcome: null,
    pending: step.mode === 'sequential' ? notYet.slice(0, 1) : notYet,
  }
}

export function evaluateWorkflow(
  steps: readonly ApprovalStepConfig[],
  actions: readonly WorkflowAction[],
): WorkflowState {
  if (actions.some((a) => a.kind === 'cancel')) {
    return {
      outcome: 'cancelled',
      overridden: false,
      steps: steps.map((s) => ({
        id: s.id,
        status: 'skipped',
        outcome: null,
        pendingAssigneeIds: [],
      })),
    }
  }
  const override = actions.find(
    (a) => a.kind === 'override_approve' || a.kind === 'override_decline',
  )
  const states: StepState[] = []
  let blocked = false
  let declined = false
  let decisionsOpen = false
  for (const step of steps) {
    if (step.assigneeIds.length === 0) {
      states.push({ id: step.id, status: 'skipped', outcome: null, pendingAssigneeIds: [] })
      continue
    }
    const result = evaluateStep(step, actions)
    const closed = Boolean(override) || declined
    const status: StepStatus = result.complete
      ? 'complete'
      : closed
        ? 'skipped'
        : blocked
          ? 'waiting'
          : 'open'
    states.push({
      id: step.id,
      status,
      outcome: result.outcome,
      pendingAssigneeIds: status === 'open' ? result.pending : [],
    })
    if (step.kind === 'decision') {
      if (result.outcome === 'declined') declined = true
      if (!result.complete) decisionsOpen = true
    }
    if (step.required && !result.complete) blocked = true
  }
  if (override) {
    return {
      outcome: override.kind === 'override_approve' ? 'approved' : 'declined',
      overridden: true,
      steps: states,
    }
  }
  const hasDecision = steps.some((s) => s.kind === 'decision' && s.assigneeIds.length > 0)
  const outcome: WorkflowOutcome = declined
    ? 'declined'
    : hasDecision && !decisionsOpen
      ? 'approved'
      : 'pending'
  return { outcome, overridden: false, steps: states }
}

/** The request status shown to people (LEAVE_STATUSES). */
export function deriveStatus(
  steps: readonly ApprovalStepConfig[],
  actions: readonly WorkflowAction[],
): LeaveStatus {
  const state = evaluateWorkflow(steps, actions)
  if (state.outcome !== 'pending') return state.outcome
  if (actions.some((a) => a.kind === 'approve')) return 'pending_final_approval'
  if (actions.some((a) => RECOMMENDATIONS.has(a.kind) || a.kind === 'comment'))
    return 'under_review'
  return 'pending'
}

export type ActionContext = {
  steps: readonly ApprovalStepConfig[]
  actions: readonly WorkflowAction[]
  requesterId: string
  startDate: string
  /** Today in Asia/Karachi (YYYY-MM-DD). */
  today: string
  viewer: { id: string; role: Role }
}

/** What the viewer may do now (the backend checks the same rules). */
export function allowedActions(ctx: ActionContext): ActionKind[] {
  const state = evaluateWorkflow(ctx.steps, ctx.actions)
  const isRequester = ctx.viewer.id === ctx.requesterId
  if (state.outcome === 'cancelled' || state.outcome === 'declined') return []
  if (state.outcome === 'approved') {
    return isRequester &&
      LEAVE_POLICY.cancelApprovedUntilDayBeforeStart &&
      ctx.today < ctx.startDate
      ? ['cancel']
      : []
  }
  if (isRequester) return ['cancel'] // never approves or reviews their own request (D-068)

  const result = new Set<ActionKind>()
  let isParticipant = false
  ctx.steps.forEach((step, index) => {
    if (!step.assigneeIds.includes(ctx.viewer.id)) return
    isParticipant = true
    const s = state.steps[index]
    if (!s?.pendingAssigneeIds.includes(ctx.viewer.id)) return
    if (step.kind === 'decision') {
      result.add('approve')
      result.add('decline')
    } else {
      result.add('recommend_approve')
      result.add('recommend_decline')
    }
  })
  const isDecider = ctx.steps.some(
    (s) => s.kind === 'decision' && s.assigneeIds.includes(ctx.viewer.id),
  )
  if (ctx.viewer.role === 'hr_admin' && !isDecider) {
    result.add('override_approve')
    result.add('override_decline')
  }
  if (isParticipant || ctx.viewer.role === 'hr_admin') result.add('comment')
  return ACTION_KINDS.filter((k) => result.has(k))
}

/** What the viewer is asked to do, for inbox labels (matches the dashboard `stage`). */
export function stageFor(actions: readonly ActionKind[]) {
  if (actions.includes('approve')) return 'final_approval' as const
  if (actions.includes('recommend_approve')) return 'recommendation' as const
  return 'review' as const
}
