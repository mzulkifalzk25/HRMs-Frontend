// Attendance rows (P4-T05, P4-T07, P4-T08): date, actual check-in/out (to the second), exact
// duration, status badges. Table on desktop, cards on mobile. HR can open corrections.
import { History, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatAppTime, formatDateKey } from '@/lib/datetime'
import { formatDuration } from '../lib/policy'
import type { AttendanceRecord } from '../schemas/attendance.schema'
import { AttendanceBadges } from './attendance-badges'

type Props = {
  records: AttendanceRecord[]
  today: string
  showEmployee?: boolean
  /** HR actions; omitted for everyone else. */
  onCorrect?: (record: AttendanceRecord) => void
  onHistory?: (record: AttendanceRecord) => void
  caption: string
}

const time = (value: string | null) => (value ? formatAppTime(value, { seconds: true }) : '—')

export function AttendanceRecordList({
  records,
  today,
  showEmployee = false,
  onCorrect,
  onHistory,
  caption,
}: Props) {
  const actions = (record: AttendanceRecord) =>
    onCorrect || (onHistory && record.corrected) ? (
      <div className="flex gap-1">
        {onCorrect ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCorrect(record)}
            aria-label={`Correct ${showEmployee ? `${record.employeeName}, ` : ''}${formatDateKey(record.date)}`}
          >
            <Pencil aria-hidden="true" />
            Correct
          </Button>
        ) : null}
        {onHistory && record.corrected ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onHistory(record)}
            aria-label={`Correction history for ${showEmployee ? `${record.employeeName}, ` : ''}${formatDateKey(record.date)}`}
          >
            <History aria-hidden="true" />
            History
          </Button>
        ) : null}
      </div>
    ) : null

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showEmployee ? <TableHead>Employee</TableHead> : null}
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Worked</TableHead>
              <TableHead>Status</TableHead>
              {onCorrect || onHistory ? <TableHead>Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatDateKey(r.date)}</TableCell>
                {showEmployee ? (
                  <TableCell>
                    <p className="font-medium">{r.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{r.departmentName ?? '—'}</p>
                  </TableCell>
                ) : null}
                <TableCell className="tabular-nums">{time(r.checkInAt)}</TableCell>
                <TableCell className="tabular-nums">{time(r.checkOutAt)}</TableCell>
                <TableCell className="tabular-nums">
                  {r.durationMs != null ? formatDuration(r.durationMs) : '—'}
                </TableCell>
                <TableCell>
                  <AttendanceBadges record={r} today={today} />
                </TableCell>
                {onCorrect || onHistory ? <TableCell>{actions(r)}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden" aria-label={caption}>
        {records.map((r) => (
          <li key={r.id} className="space-y-1.5 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {formatDateKey(r.date)}
                {showEmployee ? ` · ${r.employeeName}` : ''}
              </p>
              <AttendanceBadges record={r} today={today} />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              In {time(r.checkInAt)} · Out {time(r.checkOutAt)} ·{' '}
              {r.durationMs != null ? formatDuration(r.durationMs) : 'No total yet'}
            </p>
            {actions(r)}
          </li>
        ))}
      </ul>
    </>
  )
}
