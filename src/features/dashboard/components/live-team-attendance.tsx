// Team attendance for today from the attendance service (P4-T13): real check-ins within the
// caller's scope instead of static dashboard data. "Absent" stays provisional (Q-ATT-02).
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { useAttendanceSummary } from '@/features/attendance'
import { userMessage } from '@/services/api'
import { AttendanceSummary } from './attendance-summary'

export function LiveTeamAttendance() {
  const summary = useAttendanceSummary()
  if (summary.isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading today’s attendance…</span>
        <CardSkeleton lines={1} />
      </div>
    )
  }
  if (summary.isError) {
    return (
      <ErrorState
        title="Could not load today’s attendance"
        message={userMessage(summary.error)}
        onRetry={() => void summary.refetch()}
      />
    )
  }
  return (
    <div className="space-y-2">
      <AttendanceSummary summary={summary.data} />
      {summary.data.incomplete > 0 ? (
        <p className="text-xs text-muted-foreground">
          {summary.data.incomplete} earlier{' '}
          {summary.data.incomplete === 1 ? 'day has' : 'days have'} a missing check-out.
        </p>
      ) : null}
    </div>
  )
}
