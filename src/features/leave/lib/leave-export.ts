// CSV export of leave requests (D-087 format: RFC 4180, BOM, formula injection neutralized).
import { toCsv } from '@/lib/csv'
import { formatAppDateTime, formatDateKey } from '@/lib/datetime'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from '@/types/hr'
import type { LeaveRequest } from '../schemas/leave.schema'

export function leaveToCsv(rows: readonly LeaveRequest[]): string {
  return toCsv(
    [
      'Employee',
      'Department',
      'Type',
      'Start',
      'End',
      'Days',
      'Status',
      'Backdated',
      'Submitted (Pakistan time)',
      'Reason',
    ],
    rows.map((r) => [
      r.employeeName,
      r.departmentName ?? '',
      LEAVE_TYPE_LABELS[r.leaveType],
      formatDateKey(r.startDate),
      formatDateKey(r.endDate),
      String(r.requestedDays),
      LEAVE_STATUS_LABELS[r.status],
      r.backdated ? 'Yes' : 'No',
      formatAppDateTime(r.submittedAt),
      r.reason,
    ]),
  )
}
