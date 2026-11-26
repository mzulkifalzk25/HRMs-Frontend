// Labels and tones for leave screens (one place, reused by every list and dialog).
import type { StatusTone } from '@/components/shared/status-badge'
import { formatDateKey } from '@/lib/datetime'
import type { LeaveStatus } from '@/types/hr'
import type { RouteTarget } from './routing'
import type { ActionKind } from './workflow'

export const LEAVE_STATUS_TONE: Record<LeaveStatus, StatusTone> = {
  draft: 'neutral',
  pending: 'warning',
  under_review: 'info',
  pending_final_approval: 'info',
  approved: 'success',
  declined: 'danger',
  cancelled: 'neutral',
}

/** Timeline wording per action: "<actor> approved the request". */
export const ACTION_LABELS: Record<ActionKind, string> = {
  approve: 'approved the request',
  decline: 'declined the request',
  recommend_approve: 'recommended approval',
  recommend_decline: 'recommended declining',
  comment: 'commented',
  override_approve: 'approved the request as HR (override)',
  override_decline: 'declined the request as HR (override)',
  cancel: 'cancelled the request',
}

export const ROUTE_LABELS: Record<RouteTarget, string> = {
  managers: 'Your manager',
  hr: 'HR',
  senior_pm: 'Your Senior Project Manager',
}

export const PARTICIPANT_LABELS = {
  decision_maker: 'Decides',
  reviewer: 'Can review and recommend',
  recipient: 'Always notified',
} as const

export function days(value: number): string {
  return `${value} ${Math.abs(value) === 1 ? 'day' : 'days'}`
}

/** `25 Nov 2026` or `25 Nov 2026 – 27 Nov 2026`. */
export function dateRange(start: string, end: string): string {
  return start === end ? formatDateKey(start) : `${formatDateKey(start)} – ${formatDateKey(end)}`
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
