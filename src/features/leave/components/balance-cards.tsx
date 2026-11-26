// Allocated / used / remaining per category (P5-T05, D-062). Each category is separate (D-060).
import { EmptyState } from '@/components/feedback/empty-state'
import { LEAVE_TYPE_LABELS } from '@/types/hr'
import type { LeaveBalance } from '../schemas/leave.schema'

export function BalanceCards({ balances }: { balances: LeaveBalance[] }) {
  if (balances.every((b) => b.allocated === 0 && b.used === 0)) {
    return (
      <EmptyState
        title="No leave allocated"
        description="HR has not allocated leave for this year yet."
        className="py-6"
      />
    )
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-3" aria-label="Leave balances">
      {balances.map((b) => {
        const percent =
          b.allocated > 0 ? Math.min(100, Math.round((b.used / b.allocated) * 100)) : 0
        const label = LEAVE_TYPE_LABELS[b.leaveType]
        return (
          <li key={b.leaveType} className="space-y-2 rounded-md border bg-card p-4">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {b.remaining}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                of {b.allocated} left
              </span>
            </p>
            <div
              role="meter"
              aria-label={`${label} leave used`}
              aria-valuemin={0}
              aria-valuemax={b.allocated}
              aria-valuenow={b.used}
              aria-valuetext={`${b.used} of ${b.allocated} days used`}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <dl className="grid grid-cols-3 gap-1 text-xs">
              <div>
                <dt className="text-muted-foreground">Allocated</dt>
                <dd className="font-medium tabular-nums">{b.allocated}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Used</dt>
                <dd className="font-medium tabular-nums">{b.used}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Remaining</dt>
                <dd className="font-medium tabular-nums">{b.remaining}</dd>
              </div>
            </dl>
          </li>
        )
      })}
    </ul>
  )
}
