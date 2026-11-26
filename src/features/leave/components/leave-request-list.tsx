// Leave request rows (P5-T09, P5-T14): table on desktop, cards on mobile. Each row opens the
// request, where decisions and history live.
import { Paperclip } from 'lucide-react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatAppDateTime } from '@/lib/datetime'
import { LEAVE_TYPE_LABELS } from '@/types/hr'
import { dateRange, days } from '../lib/leave-labels'
import type { ApprovalTask, LeaveRequest } from '../schemas/leave.schema'
import { LeaveStatusBadge } from './leave-status-badge'

const STAGE_LABELS: Record<ApprovalTask['stage'], string> = {
  final_approval: 'Your decision',
  recommendation: 'Your recommendation',
  review: 'Review',
}

type Row = LeaveRequest & { stage?: ApprovalTask['stage'] }

export function LeaveRequestList({
  requests,
  caption,
  showEmployee = true,
}: {
  requests: Row[]
  caption: string
  showEmployee?: boolean
}) {
  const title = (r: Row) =>
    showEmployee
      ? `${r.employeeName}, ${LEAVE_TYPE_LABELS[r.leaveType]} leave`
      : `${LEAVE_TYPE_LABELS[r.leaveType]} leave`
  const open = (r: Row) => (
    <Link
      to={`/leave/requests/${r.id}`}
      className="font-medium text-primary underline-offset-4 hover:underline"
      aria-label={`Open ${title(r)}, ${dateRange(r.startDate, r.endDate)}`}
    >
      {showEmployee ? r.employeeName : `${LEAVE_TYPE_LABELS[r.leaveType]} leave`}
    </Link>
  )
  const badges = (r: Row) => (
    <div className="flex flex-wrap gap-1">
      {r.stage ? <StatusBadge tone="primary">{STAGE_LABELS[r.stage]}</StatusBadge> : null}
      <LeaveStatusBadge status={r.status} />
      {r.backdated ? <StatusBadge tone="neutral">Backdated</StatusBadge> : null}
    </div>
  )
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>{showEmployee ? 'Employee' : 'Request'}</TableHead>
              {showEmployee ? <TableHead>Type</TableHead> : null}
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {open(r)}
                  {showEmployee && r.departmentName ? (
                    <p className="text-xs text-muted-foreground">{r.departmentName}</p>
                  ) : null}
                </TableCell>
                {showEmployee ? <TableCell>{LEAVE_TYPE_LABELS[r.leaveType]}</TableCell> : null}
                <TableCell className="whitespace-nowrap">
                  {dateRange(r.startDate, r.endDate)}
                  {r.attachment ? (
                    <Paperclip aria-label="Has an attachment" className="ml-1 inline size-3.5" />
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.requestedDays}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatAppDateTime(r.submittedAt)}
                </TableCell>
                <TableCell>{badges(r)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden" aria-label={caption}>
        {requests.map((r) => (
          <li key={r.id} className="space-y-1.5 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">{open(r)}</p>
              {badges(r)}
            </div>
            <p className="text-xs text-muted-foreground">
              {showEmployee ? `${LEAVE_TYPE_LABELS[r.leaveType]} · ` : ''}
              {dateRange(r.startDate, r.endDate)} · {days(r.requestedDays)}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
