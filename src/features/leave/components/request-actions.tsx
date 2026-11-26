// What the signed-in user can do on a request (P5-T10…T13). The list comes from the backend
// (`allowedActions`); every action is confirmed (D-072), declines and HR overrides need a reason
// (D-068, D-089). A 409 (already decided / changed meanwhile) shows a message and the latest data.
import { Ban, Check, MessageSquare, ShieldCheck, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { Button } from '@/components/ui/button'
import { userMessage } from '@/services/api'
import { LEAVE_TYPE_LABELS } from '@/types/hr'
import { useCancelLeave, useLeaveAction } from '../api/use-leave'
import { LEAVE_POLICY } from '../lib/leave-policy'
import { dateRange, days } from '../lib/leave-labels'
import type { ActionKind } from '../lib/workflow'
import type { LeaveRequestDetail } from '../schemas/leave.schema'

type ActionConfig = {
  button: string
  icon: ComponentType<{ 'aria-hidden'?: boolean | 'true' }>
  variant: 'default' | 'outline' | 'destructive'
  title: string
  confirm: string
  destructive?: boolean
  reason?: string
  done: string
}

const ACTIONS: Record<ActionKind, ActionConfig> = {
  approve: {
    button: 'Approve',
    icon: Check,
    variant: 'default',
    title: 'Approve this leave?',
    confirm: 'Approve',
    done: 'Leave approved. The days are deducted from the balance.',
  },
  decline: {
    button: 'Decline',
    icon: X,
    variant: 'outline',
    title: 'Decline this leave?',
    confirm: 'Decline',
    destructive: true,
    reason: 'Reason for declining',
    done: 'Leave declined.',
  },
  recommend_approve: {
    button: 'Recommend approval',
    icon: ThumbsUp,
    variant: 'outline',
    title: 'Recommend approval?',
    confirm: 'Recommend',
    done: 'Recommendation recorded. The decision stays with the manager.',
  },
  recommend_decline: {
    button: 'Recommend declining',
    icon: ThumbsDown,
    variant: 'outline',
    title: 'Recommend declining?',
    confirm: 'Recommend',
    done: 'Recommendation recorded. The decision stays with the manager.',
  },
  comment: {
    button: 'Add comment',
    icon: MessageSquare,
    variant: 'outline',
    title: 'Add a comment',
    confirm: 'Add comment',
    reason: 'Comment',
    done: 'Comment added.',
  },
  override_approve: {
    button: 'Approve as HR',
    icon: ShieldCheck,
    variant: 'outline',
    title: 'Approve as HR (override)?',
    confirm: 'Approve as HR',
    reason: 'Reason for the HR decision',
    done: 'Approved by HR. The override and reason are recorded.',
  },
  override_decline: {
    button: 'Decline as HR',
    icon: ShieldCheck,
    variant: 'outline',
    title: 'Decline as HR (override)?',
    confirm: 'Decline as HR',
    destructive: true,
    reason: 'Reason for the HR decision',
    done: 'Declined by HR. The override and reason are recorded.',
  },
  cancel: {
    button: 'Cancel request',
    icon: Ban,
    variant: 'outline',
    title: 'Cancel this leave request?',
    confirm: 'Cancel request',
    destructive: true,
    done: 'Request cancelled.',
  },
}

export function RequestActions({ request }: { request: LeaveRequestDetail }) {
  const act = useLeaveAction()
  const cancel = useCancelLeave()
  const [open, setOpen] = useState<ActionKind | null>(null)
  const config = open ? ACTIONS[open] : null
  const summary = `${request.employeeName}, ${LEAVE_TYPE_LABELS[request.leaveType]} leave, ${dateRange(request.startDate, request.endDate)} (${days(request.requestedDays)}).`

  if (request.allowedActions.length === 0) return null

  function describe(kind: ActionKind) {
    if (kind === 'approve' || kind === 'override_approve')
      return `${summary} ${days(request.requestedDays)} will be deducted from ${LEAVE_TYPE_LABELS[request.leaveType]} leave.`
    if (kind === 'cancel')
      return request.status === 'approved'
        ? `${summary} The days are returned to your balance.`
        : `${summary} Nobody will be asked to decide any more.`
    if (kind.startsWith('recommend'))
      return `${summary} Your recommendation is shown to the manager, who makes the decision.`
    return summary
  }

  async function run(kind: ActionKind, reason?: string) {
    try {
      if (kind === 'cancel') {
        await cancel.mutateAsync({ id: request.id, reason: null, version: request.version })
      } else {
        await act.mutateAsync({
          id: request.id,
          input: { action: kind, comment: reason ?? null, version: request.version },
        })
      }
      toast.success(ACTIONS[kind].done)
    } catch (error) {
      toast.error(userMessage(error))
    } finally {
      setOpen(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {request.allowedActions.map((kind) => {
        const { button, icon: Icon, variant } = ACTIONS[kind]
        return (
          <Button key={kind} variant={variant} onClick={() => setOpen(kind)}>
            <Icon aria-hidden="true" />
            {button}
          </Button>
        )
      })}
      {open && config ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setOpen(null)}
          title={config.title}
          description={describe(open)}
          confirmLabel={config.confirm}
          cancelLabel="Back"
          destructive={config.destructive}
          reason={
            config.reason
              ? { label: config.reason, minLength: LEAVE_POLICY.reasonMinLength }
              : undefined
          }
          isPending={act.isPending || cancel.isPending}
          onConfirm={(reason) => void run(open, reason)}
        />
      ) : null}
    </div>
  )
}
