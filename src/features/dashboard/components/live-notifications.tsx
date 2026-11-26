// Latest notifications from the notification service (P6), replacing the Phase 2 placeholder.
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { useNotifications } from '@/features/notifications'
import { userMessage } from '@/services/api'
import { NotificationPreviewList } from './dashboard-widgets'

export function LiveNotifications() {
  const latest = useNotifications({ page: 1, pageSize: 5 })
  if (latest.isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading notifications…</span>
        <CardSkeleton lines={2} />
      </div>
    )
  }
  if (latest.isError) {
    return (
      <ErrorState
        title="Could not load notifications"
        message={userMessage(latest.error)}
        onRetry={() => void latest.refetch()}
      />
    )
  }
  return (
    <NotificationPreviewList
      notifications={latest.data.results.map((n) => ({
        id: n.id,
        title: n.title,
        at: n.createdAt,
        read: n.read,
      }))}
    />
  )
}
