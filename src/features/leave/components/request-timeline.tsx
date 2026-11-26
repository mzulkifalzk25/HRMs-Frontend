// Request history (P5-T10, P5-T11): submission, recommendations, comments, decisions, overrides
// and cancellation, oldest first.
import { formatAppDateTime } from '@/lib/datetime'
import { ACTION_LABELS } from '../lib/leave-labels'
import type { LeaveRequestDetail } from '../schemas/leave.schema'

export function RequestTimeline({ request }: { request: LeaveRequestDetail }) {
  return (
    <ol className="space-y-4 border-l pl-4" aria-label="Request history">
      <li className="relative">
        <span
          aria-hidden="true"
          className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-muted-foreground"
        />
        <p className="text-sm">
          <span className="font-medium">{request.employeeName}</span> submitted the request
        </p>
        <p className="text-xs text-muted-foreground">{formatAppDateTime(request.submittedAt)}</p>
      </li>
      {request.actions.map((a) => (
        <li key={a.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary"
          />
          <p className="text-sm">
            <span className="font-medium">{a.actorName}</span> {ACTION_LABELS[a.kind]}
          </p>
          <p className="text-xs text-muted-foreground">{formatAppDateTime(a.at)}</p>
          {a.comment ? (
            <p className="mt-1 rounded-md bg-muted/60 px-3 py-2 text-sm">“{a.comment}”</p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
