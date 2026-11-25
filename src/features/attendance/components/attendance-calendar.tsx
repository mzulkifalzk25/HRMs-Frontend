// Month calendar of own attendance (P4-T06). Shows only data supplied by the service: a past day
// without a record is "No record", never "absent" (Q-ATT-02), and no day is assumed to be a
// weekend or holiday (Q-ATT-05). Weeks are displayed Monday-first (display only).
import { cn } from '@/lib/utils'
import { shiftDateKey } from '@/lib/datetime'
import { sessionState } from '../lib/policy'
import type { AttendanceRecord } from '../schemas/attendance.schema'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type DayKind = 'on_time' | 'late' | 'incomplete' | 'in_progress' | 'no_record' | 'future'

const KIND: Record<DayKind, { label: string; className: string }> = {
  on_time: { label: 'On time', className: 'bg-success-subtle text-success-subtle-foreground' },
  late: { label: 'Late-In', className: 'bg-warning-subtle text-warning-subtle-foreground' },
  incomplete: {
    label: 'Missing check-out',
    className: 'bg-destructive-subtle text-destructive-subtle-foreground',
  },
  in_progress: { label: 'In progress', className: 'bg-info-subtle text-info-subtle-foreground' },
  no_record: { label: 'No record', className: 'bg-muted/50 text-muted-foreground' },
  future: { label: '', className: 'text-muted-foreground/60' },
}

function weekdayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const day = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay() // calendar maths only
  return (day + 6) % 7 // Monday = 0
}

export function AttendanceCalendar({
  month,
  records,
  today,
}: {
  /** `YYYY-MM` */
  month: string
  records: AttendanceRecord[]
  today: string
}) {
  const first = `${month}-01`
  const byDate = new Map(records.map((r) => [r.date, r]))
  const days: string[] = []
  for (let d = first; d.startsWith(month); d = shiftDateKey(d, 1)) days.push(d)
  const cells: Array<string | null> = [
    ...Array.from({ length: weekdayIndex(first) }, () => null),
    ...days,
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))

  const kindOf = (date: string): DayKind => {
    if (date > today) return 'future'
    const record = byDate.get(date)
    if (!record) return 'no_record'
    const state = sessionState(record, today)
    if (state === 'incomplete') return 'incomplete'
    if (state === 'in_progress') return 'in_progress'
    return record.checkInStatus === 'late' ? 'late' : 'on_time'
  }

  return (
    <div className="space-y-3">
      <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Attendance calendar for {month}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((day) => (
              <th key={day} scope="col" className="pb-1 text-xs font-medium text-muted-foreground">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((date, j) => {
                if (!date) return <td key={j} aria-hidden="true" />
                const kind = kindOf(date)
                return (
                  <td
                    key={date}
                    className={cn(
                      'h-14 rounded-md p-1.5 align-top',
                      KIND[kind].className,
                      date === today && 'ring-2 ring-primary',
                    )}
                  >
                    <span className="block text-xs font-medium tabular-nums">
                      {Number(date.slice(8))}
                    </span>
                    <span className="block truncate text-[0.6875rem]">{KIND[kind].label}</span>
                    <span className="sr-only">{date === today ? ' (today)' : ''}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-wrap gap-3 text-xs" aria-label="Legend">
        {(['on_time', 'late', 'incomplete', 'in_progress', 'no_record'] as const).map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-3 rounded-sm', KIND[kind].className)} />
            {KIND[kind].label}
          </li>
        ))}
      </ul>
    </div>
  )
}
