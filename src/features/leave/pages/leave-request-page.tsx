// One leave request (P5-T10…T13, P5-T16): details, who is involved (HR always notified), the
// approval steps, the full history, and the actions the signed-in user may take.
import { FileX, Paperclip } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { formatAppDateTime } from '@/lib/datetime'
import { ApiError, userMessage } from '@/services/api'
import { LEAVE_TYPE_LABELS } from '@/types/hr'
import { useLeaveRequest } from '../api/use-leave'
import { LeaveStatusBadge } from '../components/leave-status-badge'
import { ParticipantsPanel } from '../components/participants-panel'
import { RequestActions } from '../components/request-actions'
import { RequestTimeline } from '../components/request-timeline'
import { dateRange, days, fileSize, ROUTE_LABELS } from '../lib/leave-labels'
import type { LeaveRequestDetail } from '../schemas/leave.schema'

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}

function stepText(r: LeaveRequestDetail) {
  const decision = r.steps.find((s) => s.kind === 'decision')
  const rule =
    decision?.mode === 'sequential'
      ? 'in order, each must approve'
      : decision?.completion === 'all'
        ? 'all must approve'
        : 'any one decides'
  const review = r.steps.find((s) => s.kind === 'review')
  return `${ROUTE_LABELS[r.routedTo]} decides (${rule}).${review ? ` Reviewers are ${review.required ? 'required' : 'optional'}.` : ''}`
}

export function LeaveRequestPage() {
  const { requestId = '' } = useParams()
  const request = useLeaveRequest(requestId)

  if (request.isPending) {
    return (
      <div aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading leave request…</span>
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
    )
  }
  if (request.isError && request.error instanceof ApiError && request.error.status === 404) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leave request not found" />
        <EmptyState
          icon={FileX}
          title="This request does not exist or you cannot see it"
          action={
            <Button asChild variant="outline">
              <Link to="/leave">Back to my leave</Link>
            </Button>
          }
        />
      </div>
    )
  }
  if (request.isError) {
    return (
      <ErrorState
        title="Could not load this request"
        message={userMessage(request.error)}
        onRetry={() => void request.refetch()}
      />
    )
  }
  const r = request.data
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${LEAVE_TYPE_LABELS[r.leaveType]} leave`}
        description={`${r.employeeName} · ${dateRange(r.startDate, r.endDate)}`}
        actions={<RequestActions request={r} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Details">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Detail label="Status">
                <span className="flex flex-wrap gap-1">
                  <LeaveStatusBadge status={r.status} />
                  {r.backdated ? <StatusBadge tone="neutral">Backdated</StatusBadge> : null}
                </span>
              </Detail>
              <Detail label="Duration">{days(r.requestedDays)} (working days)</Detail>
              <Detail label="Submitted">{formatAppDateTime(r.submittedAt)}</Detail>
              <Detail label="Employee">{r.employeeName}</Detail>
              <Detail label="Department">{r.departmentName ?? '—'}</Detail>
              <Detail label="Attachment">
                {r.attachment ? (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip aria-hidden="true" className="size-3.5" />
                    {r.attachment.name} ({fileSize(r.attachment.size)})
                  </span>
                ) : (
                  'None'
                )}
              </Detail>
              <div className="sm:col-span-3">
                <dt className="text-xs text-muted-foreground">Reason</dt>
                <dd className="text-sm whitespace-pre-line">{r.reason}</dd>
              </div>
            </dl>
          </SectionCard>
          <SectionCard title="History">
            <RequestTimeline request={r} />
          </SectionCard>
        </div>
        <SectionCard title="Who is involved" description={stepText(r)}>
          <ParticipantsPanel participants={r.participants} />
        </SectionCard>
      </div>
    </div>
  )
}
