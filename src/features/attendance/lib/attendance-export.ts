// CSV export of attendance rows (P4-T12). Readable Pakistan times plus exact ISO instants, so the
// export never loses precision. Formula injection is neutralized by `toCsv` (R-012).
import { formatAppTime, formatDateKey } from '@/lib/datetime'
import { toCsv } from '@/lib/csv'
import type { AttendanceRecord } from '../schemas/attendance.schema'
import { formatDuration, sessionState } from './policy'

const CHECK_IN_LABELS = { early: 'Early', on_time: 'On time', late: 'Late-In' } as const

export function attendanceToCsv(records: readonly AttendanceRecord[], today: string): string {
  return toCsv(
    [
      'Date',
      'Employee',
      'Department',
      'Check-in (Pakistan time)',
      'Check-out (Pakistan time)',
      'Worked',
      'Check-in status',
      'Session',
      'Corrected',
      'Check-in (ISO 8601)',
      'Check-out (ISO 8601)',
    ],
    records.map((r) => [
      formatDateKey(r.date),
      r.employeeName,
      r.departmentName ?? '',
      r.checkInAt ? formatAppTime(r.checkInAt, { seconds: true }) : '',
      r.checkOutAt ? formatAppTime(r.checkOutAt, { seconds: true }) : '',
      r.durationMs != null ? formatDuration(r.durationMs) : '',
      r.checkInStatus ? CHECK_IN_LABELS[r.checkInStatus] : '',
      {
        not_checked_in: 'No check-in',
        in_progress: 'In progress',
        complete: 'Complete',
        incomplete: 'Missing check-out',
      }[sessionState(r, today)],
      r.corrected ? 'Yes' : 'No',
      r.checkInAt ?? '',
      r.checkOutAt ?? '',
    ]),
  )
}
