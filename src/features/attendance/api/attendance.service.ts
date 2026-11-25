// AttendanceService contract (P4-T03). The backend records the actual server time for check-in
// and check-out and computes statuses in Asia/Karachi (D-028); the client never sends a time for
// its own check-in. Scope as for the directory (D-044); corrections are HR-only (D-058).
import type { Page } from '@/types/api'
import type {
  AttendanceListQuery,
  AttendanceRecord,
  AttendanceSummary,
  CorrectionEntry,
  CorrectionInput,
  TodayAttendance,
} from '../schemas/attendance.schema'

type Options = { signal?: AbortSignal }

export interface AttendanceService {
  getToday(options?: Options): Promise<TodayAttendance>
  /** 409 when already checked in today (single session per day, provisional Q-ATT-03). */
  checkIn(): Promise<AttendanceRecord>
  /** 400 without a check-in; 409 when already checked out. */
  checkOut(): Promise<AttendanceRecord>
  /** Own records between two Karachi dates (inclusive). */
  listMine(range: { from: string; to: string }, options?: Options): Promise<AttendanceRecord[]>
  /** Team (managers, leads, PMs) or organization (HR) records, scoped by the backend. */
  list(query: AttendanceListQuery, options?: Options): Promise<Page<AttendanceRecord>>
  get(id: string, options?: Options): Promise<AttendanceRecord>
  /** HR only; reason is mandatory; creates an audit entry. */
  correct(id: string, input: CorrectionInput): Promise<AttendanceRecord>
  listCorrections(id: string, options?: Options): Promise<CorrectionEntry[]>
  getSummary(options?: Options): Promise<AttendanceSummary>
}
