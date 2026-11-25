// Status badges for attendance. Late-In is tracking only (D-053); checkout before 17:45 is shown
// neutrally because its policy is undecided (Q-ATT-01).
import { StatusBadge } from '@/components/shared/status-badge'
import { sessionState } from '../lib/policy'
import type { AttendanceRecord } from '../schemas/attendance.schema'

export function AttendanceBadges({ record, today }: { record: AttendanceRecord; today: string }) {
  const state = sessionState(record, today)
  return (
    <span className="flex flex-wrap gap-1">
      {record.checkInStatus === 'late' ? <StatusBadge tone="warning">Late-In</StatusBadge> : null}
      {record.checkInStatus === 'on_time' ? (
        <StatusBadge tone="success">On time</StatusBadge>
      ) : null}
      {record.checkInStatus === 'early' ? <StatusBadge tone="success">Early</StatusBadge> : null}
      {state === 'in_progress' ? <StatusBadge tone="info">In progress</StatusBadge> : null}
      {state === 'incomplete' ? <StatusBadge tone="danger">Missing check-out</StatusBadge> : null}
      {record.checkOutStatus === 'before_window' ? (
        <StatusBadge tone="neutral">Left before 5:45 PM</StatusBadge>
      ) : null}
      {record.corrected ? <StatusBadge tone="primary">Corrected</StatusBadge> : null}
    </span>
  )
}
