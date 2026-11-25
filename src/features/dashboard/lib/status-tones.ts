// Status → semantic tone/label mappings for dashboards (one place, reused by every list).
import type { StatusTone } from '@/components/shared/status-badge'
import type { LeaveStatus, TodayStatus } from '@/types/hr'
import type { ApprovalTask } from '../schemas/dashboard.schema'

export const LEAVE_STATUS_TONE: Record<LeaveStatus, StatusTone> = {
  draft: 'neutral',
  pending: 'warning',
  under_review: 'info',
  pending_final_approval: 'info',
  approved: 'success',
  declined: 'danger',
  cancelled: 'neutral',
}

export const TODAY_STATUS_TONE: Record<TodayStatus, StatusTone> = {
  present: 'success',
  late: 'warning',
  on_leave: 'info',
  not_checked_in: 'neutral',
  absent: 'danger',
}

export const APPROVAL_STAGE_LABELS: Record<ApprovalTask['stage'], string> = {
  review: 'Review and comment',
  recommendation: 'Recommendation',
  final_approval: 'Final approval',
}

export const APPROVAL_STAGE_TONE: Record<ApprovalTask['stage'], StatusTone> = {
  review: 'neutral',
  recommendation: 'info',
  final_approval: 'primary',
}
