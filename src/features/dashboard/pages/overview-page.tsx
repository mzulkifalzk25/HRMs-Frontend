// Phase 1 landing page. Role dashboards replace it in Phase 2 (P2-T13…T18).
// Shows the full data path working end to end, with loading, error and success states.
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { formatAppDateTime } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import type { HealthService } from '@/services/health/health.service'
import { useSystemHealth } from '../api/use-system-health'

export function OverviewPage({ health }: { health?: HealthService }) {
  const query = useSystemHealth(health)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="FormbaxHR foundation. Role-specific dashboards arrive in Phase 2."
      />

      <section
        aria-labelledby="system-status-heading"
        aria-busy={query.isPending}
        className="max-w-xl"
      >
        <h2 id="system-status-heading" className="mb-3 text-sm font-semibold">
          System status
        </h2>
        {query.isPending ? (
          <>
            <CardSkeleton lines={2} />
            <span className="sr-only">Loading system status…</span>
          </>
        ) : query.isError ? (
          <ErrorState
            title="Could not check system status"
            message={userMessage(query.error)}
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : (
          <div className="flex items-start gap-3 rounded-lg border bg-card p-5 shadow-xs">
            {query.data.status === 'ok' ? (
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 text-success" />
            ) : (
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 text-warning-foreground" />
            )}
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {query.data.status === 'ok'
                  ? 'All systems operational'
                  : 'Running with degraded service'}
              </p>
              <p className="text-muted-foreground">
                Source:{' '}
                {query.data.source === 'mock' ? 'mock services (fictional data)' : 'FormbaxHR API'}
                {' · '}
                Checked {formatAppDateTime(query.data.checkedAt)} (Pakistan time)
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
