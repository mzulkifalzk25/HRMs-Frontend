// Attendance contracts (P4-T01). Actual timestamps are kept exactly (ISO 8601 with offset); the
// backend computes the status fields in Asia/Karachi (D-028) and the frontend only displays them.
import { z } from 'zod'
import { appWallClockToInstant, toAppIsoString } from '@/lib/datetime'
import { dateKeySchema, instantSchema } from '@/types/hr'

export const checkInStatusSchema = z.enum(['early', 'on_time', 'late'])
export const checkOutStatusSchema = z.enum(['within_window', 'before_window'])

export const attendanceRecordSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  departmentName: z.string().nullable(),
  /** Karachi calendar day of the check-in. */
  date: dateKeySchema,
  checkInAt: instantSchema.nullable(),
  checkOutAt: instantSchema.nullable(),
  checkInStatus: checkInStatusSchema.nullable(),
  checkOutStatus: checkOutStatusSchema.nullable(),
  /** Exact checkout − check-in; null while open. Never rounded, no break deduction. */
  durationMs: z.number().int().nonnegative().nullable(),
  /** True when HR changed the times; see the correction history. */
  corrected: z.boolean(),
})
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>

/** Today's own attendance (null record = not checked in yet). */
export const todayAttendanceSchema = z.object({
  date: dateKeySchema,
  record: attendanceRecordSchema.nullable(),
})
export type TodayAttendance = z.infer<typeof todayAttendanceSchema>

export const ATTENDANCE_FILTERS = ['late', 'incomplete', 'corrected'] as const
export type AttendanceFilter = (typeof ATTENDANCE_FILTERS)[number]

export const ATTENDANCE_FILTER_LABELS: Record<AttendanceFilter, string> = {
  late: 'Late-In only',
  incomplete: 'Missing check-out only',
  corrected: 'Corrected only',
}

export type AttendanceListQuery = {
  from: string
  to: string
  page: number
  pageSize: number
  employeeId?: string
  departmentId?: string
  teamId?: string
  filter?: AttendanceFilter
}

/** Counts for today within the caller's scope. "absent" is provisional (Q-ATT-02). */
export const attendanceSummarySchema = z.object({
  date: dateKeySchema,
  total: z.number().int().nonnegative(),
  present: z.number().int().nonnegative(),
  late: z.number().int().nonnegative(),
  onLeave: z.number().int().nonnegative(),
  notCheckedIn: z.number().int().nonnegative(),
  absent: z.number().int().nonnegative(),
  incomplete: z.number().int().nonnegative(),
})
export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>

const sessionTimes = z.object({
  checkInAt: instantSchema.nullable(),
  checkOutAt: instantSchema.nullable(),
})

export const correctionEntrySchema = z.object({
  id: z.string(),
  recordId: z.string(),
  actorName: z.string(),
  at: instantSchema,
  reason: z.string(),
  before: sessionTimes,
  after: sessionTimes,
})
export type CorrectionEntry = z.infer<typeof correctionEntrySchema>

export type CorrectionInput = {
  checkInAt: string | null
  checkOutAt: string | null
  reason: string
}

// --- Correction form (P4-T10) ---------------------------------------------------------------
// Times are entered as Karachi wall-clock times on the record's date. Same-day sessions only
// (provisional, Q-ATT-03); HR-only with a mandatory reason (D-058, Q-ATT-04 provisional).

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Enter a time as HH:MM or HH:MM:SS.')
  .or(z.literal(''))

export const CORRECTION_REASON_MIN_LENGTH = 5

export function correctionFormSchema(date: string) {
  return z
    .object({
      checkIn: time,
      checkOut: time,
      reason: z
        .string()
        .trim()
        .min(
          CORRECTION_REASON_MIN_LENGTH,
          'Give a reason for this correction (at least 5 characters).',
        ),
    })
    .superRefine((value, ctx) => {
      if (!value.checkIn && value.checkOut) {
        ctx.addIssue({
          code: 'custom',
          path: ['checkIn'],
          message: 'A check-out needs a check-in time.',
        })
      }
      if (value.checkIn && value.checkOut) {
        const inAt = appWallClockToInstant(
          date,
          value.checkIn.length === 5 ? `${value.checkIn}:00` : value.checkIn,
        )
        const outAt = appWallClockToInstant(
          date,
          value.checkOut.length === 5 ? `${value.checkOut}:00` : value.checkOut,
        )
        if (outAt.getTime() <= inAt.getTime()) {
          ctx.addIssue({
            code: 'custom',
            path: ['checkOut'],
            message: 'Check-out must be after check-in.',
          })
        }
      }
    })
    .transform((value): CorrectionInput => ({
      checkInAt: value.checkIn ? toAppIsoString(appWallClockToInstant(date, value.checkIn)) : null,
      checkOutAt: value.checkOut
        ? toAppIsoString(appWallClockToInstant(date, value.checkOut))
        : null,
      reason: value.reason,
    }))
}
export type CorrectionFormValues = { checkIn: string; checkOut: string; reason: string }
