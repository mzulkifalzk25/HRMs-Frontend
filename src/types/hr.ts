// Shared HR vocabulary used across features (dashboards now; leave and attendance later).
import { z } from 'zod'

/** Leave categories and annual allowances (D-060). */
export const LEAVE_TYPES = ['medical_sick', 'casual', 'annual'] as const
export const leaveTypeSchema = z.enum(LEAVE_TYPES)
export type LeaveType = z.infer<typeof leaveTypeSchema>

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  medical_sick: 'Medical/Sick',
  casual: 'Casual',
  annual: 'Annual',
}

/** Confirmed annual allowance per category (D-060): 7 + 7 + 7 = 21 days. */
export const ANNUAL_LEAVE_ALLOWANCE: Record<LeaveType, number> = {
  medical_sick: 7,
  casual: 7,
  annual: 7,
}

/** Leave request lifecycle (example statuses from the requirements). */
export const LEAVE_STATUSES = [
  'draft',
  'pending',
  'under_review',
  'pending_final_approval',
  'approved',
  'declined',
  'cancelled',
] as const
export const leaveStatusSchema = z.enum(LEAVE_STATUSES)
export type LeaveStatus = z.infer<typeof leaveStatusSchema>

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  under_review: 'Under review',
  pending_final_approval: 'Pending final approval',
  approved: 'Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

/**
 * Today's attendance state of a person as reported by the backend. "absent" is provisional:
 * its definition is still open (Q-ATT-02), so the frontend never derives it.
 */
export const TODAY_STATUSES = ['present', 'late', 'on_leave', 'not_checked_in', 'absent'] as const
export const todayStatusSchema = z.enum(TODAY_STATUSES)
export type TodayStatus = z.infer<typeof todayStatusSchema>

export const TODAY_STATUS_LABELS: Record<TodayStatus, string> = {
  present: 'Present',
  late: 'Late-In',
  on_leave: 'On leave',
  not_checked_in: 'Not checked in',
  absent: 'Absent',
}

/** Calendar date `YYYY-MM-DD` (D5). */
export const dateKeySchema = z.iso.date()
/** Instant: ISO 8601 with explicit offset (D5). */
export const instantSchema = z.iso.datetime({ offset: true })
