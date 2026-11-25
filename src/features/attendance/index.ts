// Public API of the attendance feature (docs/ARCHITECTURE.md §2).
// Pages are lazy-loaded by the router directly (code splitting).
export { attendanceKeys, useAttendanceSummary, useTodayAttendance } from './api/use-attendance'
export { CheckInCard } from './components/check-in-card'
export {
  ATTENDANCE_POLICY,
  classifyCheckIn,
  classifyCheckOut,
  workingDurationMs,
} from './lib/policy'
export type { AttendanceService } from './api/attendance.service'
export type { AttendanceRecord, AttendanceSummary } from './schemas/attendance.schema'
