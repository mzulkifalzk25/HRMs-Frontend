// Team attendance counts for today. Values come from the backend; "absent" is provisional (Q-ATT-02).
import { cn } from '@/lib/utils'
import type { AttendanceSummary as Summary } from '../schemas/dashboard.schema'

const ITEMS: Array<{ key: keyof Omit<Summary, 'total'>; label: string; dot: string }> = [
  { key: 'present', label: 'Present', dot: 'bg-success' },
  { key: 'late', label: 'Late-In', dot: 'bg-warning' },
  { key: 'onLeave', label: 'On leave', dot: 'bg-info' },
  { key: 'notCheckedIn', label: 'Not checked in', dot: 'bg-muted-foreground' },
  { key: 'absent', label: 'Absent*', dot: 'bg-destructive' },
]

export function AttendanceSummary({ summary }: { summary: Summary }) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ITEMS.map((item) => (
          <div key={item.key} className="rounded-md bg-muted/60 px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className={cn('size-2 rounded-full', item.dot)} />
              {item.label}
            </dt>
            <dd className="text-xl font-semibold tabular-nums">{summary[item.key]}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        {summary.total} people in scope. *How &ldquo;absent&rdquo; is counted is provisional until
        the attendance rules are confirmed.
      </p>
    </div>
  )
}
