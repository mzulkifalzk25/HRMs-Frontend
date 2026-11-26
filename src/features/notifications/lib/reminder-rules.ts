// Attendance reminders (P6-T07, D-093). The backend creates them; the mock runs these rules.
// All times are Pakistan time (D-050).
//   • No check-in: at 9:15 AM on a working day (Monday–Friday), for active people who have no
//     attendance record that day and are not on approved leave.
//   • Missing check-out: the next morning (9:00 AM, provisional detail) after a day with a
//     check-in but no check-out. Never closes the session (Q-ATT-06 stays open).
import { weekdayOf } from '@/features/leave/lib/duration'
import { appWallClockToInstant, shiftDateKey } from '@/lib/datetime'

export const REMINDER_POLICY = {
  workingWeekdays: [1, 2, 3, 4, 5] as readonly number[],
  checkInReminderAt: '09:15',
  missingCheckOutReminderAt: '09:00',
  /** How far back forgotten check-outs are reminded about. */
  missingCheckOutLookbackDays: 7,
}

export type ReminderKind = 'no_check_in' | 'missing_check_out'
export type DueReminder = { kind: ReminderKind; date: string; dueAt: Date }

export type ReminderInput = {
  now: Date
  /** Today's Pakistan date (YYYY-MM-DD). */
  today: string
  active: boolean
  checkedInToday: boolean
  onLeaveToday: boolean
  /** Own attendance records with their check-in/out instants (any recent range). */
  records: ReadonlyArray<{ date: string; checkInAt: string | null; checkOutAt: string | null }>
}

export function remindersDue(input: ReminderInput): DueReminder[] {
  if (!input.active) return []
  const due: DueReminder[] = []
  const checkInDue = appWallClockToInstant(input.today, REMINDER_POLICY.checkInReminderAt)
  if (
    REMINDER_POLICY.workingWeekdays.includes(weekdayOf(input.today)) &&
    !input.checkedInToday &&
    !input.onLeaveToday &&
    input.now.getTime() >= checkInDue.getTime()
  ) {
    due.push({ kind: 'no_check_in', date: input.today, dueAt: checkInDue })
  }
  const oldest = shiftDateKey(input.today, -REMINDER_POLICY.missingCheckOutLookbackDays)
  for (const r of input.records) {
    if (!r.checkInAt || r.checkOutAt || r.date >= input.today || r.date < oldest) continue
    const dueAt = appWallClockToInstant(
      shiftDateKey(r.date, 1),
      REMINDER_POLICY.missingCheckOutReminderAt,
    )
    if (input.now.getTime() >= dueAt.getTime())
      due.push({ kind: 'missing_check_out', date: r.date, dueAt })
  }
  return due
}
