import { StatusBadge } from '@/components/shared/status-badge'
import { LEAVE_STATUS_LABELS, type LeaveStatus } from '@/types/hr'
import { LEAVE_STATUS_TONE } from '../lib/leave-labels'

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <StatusBadge tone={LEAVE_STATUS_TONE[status]}>{LEAVE_STATUS_LABELS[status]}</StatusBadge>
}
