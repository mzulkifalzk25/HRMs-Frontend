// Loading / error / success wrapper shared by all six dashboards.
import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { userMessage } from '@/services/api'

export function DashboardQueryView<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
}) {
  if (query.isPending) {
    return (
      <div aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading dashboard…</span>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <CardSkeleton key={index} lines={1} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load your dashboard"
        message={userMessage(query.error)}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    )
  }
  return <>{children(query.data)}</>
}
